/**
 * Submits only explicitly authorized, validated source signals through the
 * terminal order-submission and risk-control path.
 */
export function createSourceExecutionService({ db, connections, terminal, sources, queries, logger }) {
  async function executeIntent({ intentId }) {
    const intent = await queries.findExecutionIntentById(intentId);
    if (!intent || !['created', 'held'].includes(intent.status)) return { skipped: true };
    if (intent.payload?.executionMode !== 'authorized_automation') return { skipped: true };

    const candidate = await queries.findCandidateById(intent.signal_id);
    if (!candidate) throw new Error(`Signal candidate for intent ${intentId} was not found`);
    const validation = await queries.findLatestValidation(candidate.id);
    const sourceResult = await db.query(
      `SELECT id, workspace_id, created_by FROM signal_sources WHERE id = $1 AND status = 'active' AND monitoring_enabled = true`,
      [candidate.source_id]
    );
    const source = sourceResult.rows[0];
    if (!source || validation?.outcome !== 'passed') {
      await queries.updateExecutionIntentStatus(intentId, 'held');
      return { held: true, reason: 'Source is inactive or validation is not passed' };
    }

    const config = await sources.registry.getExecutionConfig({
      workspaceId: source.workspace_id,
      sourceId: source.id,
    });
    if (config.mode !== 'authorized_automation') {
      await queries.updateExecutionIntentStatus(intentId, 'held');
      return { held: true, reason: 'Authorized automation is not enabled' };
    }

    const marketType = candidate.market_type;
    if (!['spot', 'futures'].includes(marketType) || !candidate.order_type ||
        (!candidate.entry && !candidate.entry_range) || !candidate.stop_loss) {
      await queries.updateExecutionIntentStatus(intentId, 'held');
      return { held: true, reason: 'Required trade details are incomplete' };
    }
    if (candidate.order_type === 'market' && config.settings?.allowMarketOrders === false) {
      await queries.updateExecutionIntentStatus(intentId, 'held');
      return { held: true, reason: 'Market orders are disabled for this source' };
    }
    if (marketType === 'spot' && candidate.direction !== 'long') {
      await queries.updateExecutionIntentStatus(intentId, 'held');
      return { held: true, reason: 'Spot short positions are not supported' };
    }

    const allowedSymbols = config.settings?.allowedSymbols;
    const normalizedSymbol = normalizeSymbol(candidate.instrument);
    if (Array.isArray(allowedSymbols) && allowedSymbols.length > 0 &&
        !allowedSymbols.some((symbol) => normalizeSymbol(symbol) === normalizedSymbol)) {
      await queries.updateExecutionIntentStatus(intentId, 'held');
      return { held: true, reason: 'Signal instrument is not in the allowed-symbol list' };
    }

    const destinations = await queries.listExecutionDestinationResults(intentId);
    if (!destinations.length) {
      await queries.updateExecutionIntentStatus(intentId, 'held');
      return { held: true, reason: 'No destination accounts are configured' };
    }

    const targets = await queries.listTargetsForCandidate(candidate.id);
    const takeProfit = targets[0]?.value;
    if (!takeProfit) {
      await queries.updateExecutionIntentStatus(intentId, 'held');
      return { held: true, reason: 'No take-profit target is available' };
    }

    let submitted = 0;
    let uncertain = 0;
    let awaitingConfirmation = 0;
    let failed = 0;

    for (const destination of destinations) {
      if (destination.status !== 'pending') continue;
      const claim = await db.query(
        `
        UPDATE trading_execution_destination_results
        SET attempted_at = now()
        WHERE id = $1 AND status = 'pending'
          AND (attempted_at IS NULL OR attempted_at < now() - interval '5 minutes')
        RETURNING *
        `,
        [destination.id]
      );
      if (!claim.rows[0]) continue;

      try {
        const account = await connections.requireAccountAccess({
          accountId: destination.account_id,
          workspaceId: intent.workspace_id,
          operation: 'execute_trades',
        });
        if (account.status !== 'active') throw new Error('Destination account is inactive');
        const connection = await connections.getConnection(account.connection_id);
        if (connection.status !== 'active' || connection.environment !== 'live') {
          throw new Error('Destination connection is not an active live connection');
        }

        const instrument = await connections.getInstrument({
          exchangeCode: connection.exchange_code,
          symbol: candidate.instrument,
          marketType,
        });
        if (!instrument || instrument.trading_status !== 'active') {
          throw new Error(`Instrument ${candidate.instrument} is not tradable on ${connection.exchange_code}`);
        }

        const referencePrice = await getReferencePrice({
          exchangeCode: connection.exchange_code,
          symbol: instrument.exchange_symbol,
          marketType,
        });
        const entryPrice = candidate.entry ? Number(candidate.entry) : null;
        const price = candidate.order_type === 'limit' ? entryPrice : null;
        if (candidate.order_type === 'limit' && (!Number.isFinite(price) || price <= 0)) {
          throw new Error('Limit order requires a single, valid entry price');
        }
        if (candidate.entry_range) {
          const low = Number(candidate.entry_range.min);
          const high = Number(candidate.entry_range.max);
          if (!Number.isFinite(low) || !Number.isFinite(high) || low > high ||
              (candidate.order_type === 'market' && (referencePrice < low || referencePrice > high))) {
            throw new Error('Current price is outside the signal entry range');
          }
        } else if (candidate.order_type === 'market' && entryPrice) {
          const deviationPct = Math.abs(referencePrice - entryPrice) / entryPrice * 100;
          if (deviationPct > 1) {
            throw new Error('Current price is too far from the signal entry price');
          }
        }

        const executionPrice = price || referencePrice;
        const stopLoss = Number(candidate.stop_loss);
        const stopDistance = Math.abs(executionPrice - stopLoss);
        if (!Number.isFinite(stopLoss) || stopLoss <= 0 || stopDistance <= 0 ||
            (candidate.direction === 'long' && stopLoss >= executionPrice) ||
            (candidate.direction === 'short' && stopLoss <= executionPrice)) {
          throw new Error('Stop-loss is invalid for the order entry price');
        }
        if ((candidate.direction === 'long' && Number(takeProfit) <= executionPrice) ||
            (candidate.direction === 'short' && Number(takeProfit) >= executionPrice)) {
          throw new Error('Take-profit is invalid for the order entry price');
        }

        const adapter = await connections.getAdapter(connection.exchange_code);
        if (typeof adapter.fetchAccountState !== 'function') {
          throw new Error('Account balance data is unavailable for safe order sizing');
        }
        const credentials = await connections.loadCredentials(connection.id);
        const accountState = await adapter.fetchAccountState({
          ...credentials,
          accountType: account.account_type,
          environment: connection.environment,
        });
        const balances = Array.isArray(accountState?.balances) ? accountState.balances : [];
        const balance = balances.find((item) =>
          String(item.asset || '').toUpperCase() === String(
            marketType === 'spot' ? instrument.quote_asset : instrument.settlement_asset || instrument.quote_asset
          ).toUpperCase()
        );
        const equity = marketType === 'futures'
          ? Number(accountState?.availableEquity ?? accountState?.availableMargin)
          : Number(balance?.free ?? balance?.available ?? balance?.availableBalance);
        if (!Number.isFinite(equity) || equity <= 0) {
          throw new Error('Available account equity could not be verified');
        }

        const riskPct = Number(config.settings?.riskPerTradePct);
        const maxLeverage = Number(config.settings?.maxLeverage);
        if (!Number.isFinite(riskPct) || riskPct <= 0 || riskPct > 5 ||
            !Number.isInteger(maxLeverage) || maxLeverage < 1 || maxLeverage > 20) {
          throw new Error('Automation risk settings are invalid');
        }
        const leverage = marketType === 'futures'
          ? Math.min(Number(candidate.leverage) || 1, maxLeverage)
          : undefined;
        const quantityByRisk = equity * riskPct / 100 / stopDistance;
        const maxNotional = Number(config.settings?.maxNotional);
        const notionalLimit = Number.isFinite(maxNotional) && maxNotional > 0
          ? Math.min(equity * (leverage || 1), maxNotional)
          : equity * (leverage || 1);
        const quantityByNotional = notionalLimit / executionPrice;
        const quantity = Math.min(quantityByRisk, quantityByNotional);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Calculated order quantity is invalid');
        }

        const result = await terminal.submitOrder(
          {
            userId: source.created_by,
            workspaceId: intent.workspace_id,
            connectionId: connection.id,
            accountId: account.id,
            marketType,
            instrumentId: instrument.exchange_symbol,
            side: candidate.direction === 'long' ? 'buy' : 'sell',
            type: candidate.order_type,
            quantity: quantity.toPrecision(12),
            price: price ? String(price) : undefined,
            stopLoss: String(candidate.stop_loss),
            takeProfit: String(takeProfit),
            leverage,
            idempotencyKey: destination.idempotency_key,
          },
          { source: 'signal_automation' },
        );

        if (result.requiresConfirmation) {
          awaitingConfirmation += 1;
          await updateDestination(destination.id, 'pending', {
            reason: 'Risk policy requires manual confirmation',
            executionRequestId: result.executionRequest?.id,
          });
        } else if (result.order?.id) {
          submitted += 1;
          await updateDestination(destination.id, 'submitted', {
            orderId: result.order.id,
            status: result.order.status,
          });
        } else {
          uncertain += 1;
          await updateDestination(destination.id, 'uncertain', {
            reason: 'Order submission returned no verifiable order',
          });
        }
      } catch (error) {
        failed += 1;
        const status = [
          'RECONCILIATION_REQUIRED',
          'ORDER_IN_PROGRESS',
          'ETIMEDOUT',
          'NETWORK_TIMEOUT',
        ].includes(error.code)
          ? 'uncertain'
          : 'failed';
        if (status === 'uncertain') uncertain += 1;
        await updateDestination(destination.id, status, {
          code: error.code || null,
          reason: error.message,
        });
        logger.error({ err: error, intentId, accountId: destination.account_id }, 'Signal order submission failed');
      }
    }

    const status = submitted > 0 || uncertain > 0
      ? 'dispatched'
      : awaitingConfirmation > 0
        ? 'held'
        : failed > 0
          ? 'failed'
          : 'held';
    await queries.updateExecutionIntentStatus(intentId, status, status === 'failed' ? new Date() : null);
    return { status, submitted, uncertain, awaitingConfirmation, failed };
  }

  async function resumePendingIntents({ limit = 50 } = {}) {
    const result = await db.query(
      `
      SELECT id
      FROM trading_execution_intents
      WHERE operation_type = 'signal_execution'
        AND status = 'created'
        AND payload->>'executionMode' = 'authorized_automation'
      ORDER BY created_at
      LIMIT $1
      `,
      [Math.max(1, Math.min(100, Number(limit) || 50))]
    );
    for (const intent of result.rows) {
      await executeIntent({ intentId: intent.id });
    }
    return { resumed: result.rows.length };
  }

  async function getReferencePrice({ exchangeCode, symbol, marketType }) {
    if (marketType === 'spot') {
      return connections.marketData.getSpotPrice({ exchangeCode, symbol });
    }
    const marketData = await connections.marketData.getMarketData({
      exchangeCode,
      symbol,
      marketType,
      timeframe: '1m',
      limit: 2,
    });
    const price = Number(marketData?.overview?.lastPrice);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`No valid ${marketType} reference price is available for ${symbol}`);
    }
    return price;
  }

  async function updateDestination(id, status, result) {
    await db.query(
      `
      UPDATE trading_execution_destination_results
      SET status = $2, result = $3, completed_at = CASE WHEN $2 IN ('submitted', 'succeeded', 'failed', 'uncertain', 'cancelled') THEN now() ELSE NULL END
      WHERE id = $1
      `,
      [id, status, JSON.stringify(result)]
    );
  }

  function normalizeSymbol(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  return { executeIntent, resumePendingIntents };
}

export default createSourceExecutionService;

import { fnv1aHash } from '@syncexc/shared';
import { resolveBracketProtectionPlan } from '../connections/bracket-protection.policy.js';

function resolveSignalPrice(signal) {
  if (signal.entry != null) return Number(signal.entry);
  const range = typeof signal.entry_range === 'string'
    ? JSON.parse(signal.entry_range)
    : signal.entry_range;
  if (range?.min != null && range?.max != null) {
    const minText = String(range.min);
    const maxText = String(range.max);
    const minParts = minText.split('.');
    const maxParts = maxText.split('.');
    const scale = Math.max(minParts[1]?.length || 0, maxParts[1]?.length || 0);
    if (scale > 12 || !/^\d+(?:\.\d+)?$/.test(minText) || !/^\d+(?:\.\d+)?$/.test(maxText)) {
      return null;
    }
    const outputScale = scale + 1;
    const scaleValue = (parts) =>
      BigInt(`${parts[0]}${(parts[1] || '').padEnd(scale, '0')}`) * (10n ** BigInt(outputScale - scale));
    const midpoint = (scaleValue(minParts) + scaleValue(maxParts)) / 2n;
    const digits = midpoint.toString().padStart(outputScale + 1, '0');
    const whole = digits.slice(0, -outputScale);
    const fraction = digits.slice(-outputScale).replace(/0+$/, '');
    return Number(fraction ? `${whole}.${fraction}` : whole);
  }
  return null;
}

function formatQuantity(quantity) {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return quantity.toFixed(12).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function resolveTakeProfit(targets) {
  const parsedTargets = typeof targets === 'string' ? JSON.parse(targets) : targets;
  const firstTarget = Array.isArray(parsedTargets) ? parsedTargets[0] : null;
  const price = firstTarget && typeof firstTarget === 'object'
    ? firstTarget.price
    : firstTarget;
  return price == null ? null : String(price);
}

export function createTraderSignalExecutionService({
  db,
  queries,
  connections,
  terminal,
  marketData,
  performance,
  logger,
}) {
  async function recordExecution(data) {
    await db.tx((tx) => queries.recordTraderSignalExecution(tx, data));
  }

  async function executePublishedSignal({ publishedSignalId }) {
    const signal = await queries.findPublishedSignalById(publishedSignalId);
    if (!signal || !['published', 'updated'].includes(signal.status)) return;
    if (signal.source_order_id) return;

    const accounts = await queries.listTraderSignalExecutionAccounts(
      signal.user_id,
      signal.workspace_id,
    );
    if (accounts.length === 0) {
      logger.info(
        { signalId: signal.id, workspaceId: signal.workspace_id },
        'Trader signal execution skipped: no active exchange accounts are connected',
      );
      return;
    }

    const percentageValue = await queries.getTraderSignalExecutionPercentage(signal.user_id);
    const percentage = Number(percentageValue);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      await Promise.all(accounts.map((account) => recordExecution({
        signalId: signal.id,
        workspaceId: signal.workspace_id,
        userId: signal.user_id,
        connectionId: account.connection_id,
        accountId: account.account_id,
        status: 'skipped_not_configured',
        errorMessage: 'Set a trader signal execution percentage in trading preferences.',
      })));
      logger.info(
        { signalId: signal.id },
        'Trader signal execution skipped: balance percentage is not configured',
      );
      return;
    }

    const marketType = signal.market_type === 'spot' ? 'spot' : 'futures';
    for (const account of accounts) {
      if (account.connection_status && account.connection_status !== 'active' ||
        account.account_status && account.account_status !== 'active') {
        await recordExecution({
          signalId: signal.id,
          workspaceId: signal.workspace_id,
          userId: signal.user_id,
          connectionId: account.connection_id,
          accountId: account.account_id,
          status: 'skipped_unhealthy_account',
        });
        continue;
      }
      try {
        const price = signal.order_type === 'limit'
          ? resolveSignalPrice(signal)
          : await fetchReferencePrice(marketData, account.exchange_code, signal.instrument, marketType);
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error('No valid reference price is available for signal sizing');
        }
        await executeForAccount({ signal, account, marketType, price, percentage });
      } catch (err) {
        await recordExecution({
          signalId: signal.id,
          workspaceId: signal.workspace_id,
          userId: signal.user_id,
          connectionId: account.connection_id,
          accountId: account.account_id,
          status: 'failed',
          errorMessage: err.message,
        });
        logger.error(
          { err, signalId: signal.id, accountId: account.account_id },
          'Trader signal execution failed for account',
        );
      }
    }
  }

  async function executeSignalForPublication({ signal, accountIds, amount }) {
    if (!signal?.id || !Array.isArray(accountIds) || accountIds.length === 0) {
      throw new Error('Signal execution requires a saved signal and at least one selected account');
    }
    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new Error('Trader execution amount must be a positive quote-currency amount');
    }
    const accounts = await queries.listTraderSignalExecutionAccounts(
      signal.user_id,
      signal.workspace_id,
      accountIds,
    );
    const foundAccountIds = new Set(accounts.map((account) => account.account_id));
    if (accountIds.some((accountId) => !foundAccountIds.has(accountId))) {
      throw new Error('One or more selected trader accounts are unavailable in this workspace');
    }

    const marketType = signal.market_type === 'spot' ? 'spot' : 'futures';
    for (const account of accounts) {
      if (
        account.connection_status !== 'active' ||
        account.account_status !== 'active'
      ) {
        await recordExecution({
          signalId: signal.id,
          workspaceId: signal.workspace_id,
          userId: signal.user_id,
          connectionId: account.connection_id,
          accountId: account.account_id,
          status: 'skipped_unhealthy_account',
          errorMessage: `Connection status: ${account.connection_status}; account status: ${account.account_status}.`,
        });
        continue;
      }

      try {
        const price = signal.order_type === 'limit'
          ? resolveSignalPrice(signal)
          : await fetchReferencePrice(
            marketData,
            account.exchange_code,
            signal.instrument,
            marketType,
          );
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error('No valid reference price is available for signal sizing');
        }
        await executeForAccount({
          signal,
          account,
          marketType,
          price,
          requestedAmount,
        });
      } catch (err) {
        await recordExecution({
          signalId: signal.id,
          workspaceId: signal.workspace_id,
          userId: signal.user_id,
          connectionId: account.connection_id,
          accountId: account.account_id,
          status: 'failed',
          errorMessage: err.message,
        });
        logger.error(
          { err, signalId: signal.id, accountId: account.account_id },
          'Trader signal execution failed for account',
        );
      }
    }
  }

  async function executeForAccount({
    signal,
    account,
    marketType,
    price,
    percentage,
    requestedAmount,
  }) {
    const adapter = await connections.getAdapter(account.exchange_code);
    const supported = marketType === 'spot'
      ? adapter?.capabilities?.hasSpot
      : adapter?.capabilities?.hasFutures;
    if (!supported) {
      await recordExecution({
        signalId: signal.id,
        workspaceId: signal.workspace_id,
        userId: signal.user_id,
        connectionId: account.connection_id,
        accountId: account.account_id,
        status: 'skipped_market_unsupported',
      });
      logger.warn(
        { signalId: signal.id, accountId: account.account_id, exchange: account.exchange_code, marketType },
        'Trader signal execution skipped: exchange does not support this market',
      );
      return;
    }

    const instrument = await connections.getInstrument({
      exchangeCode: account.exchange_code,
      symbol: signal.instrument,
      marketType,
    });
    if (!instrument || instrument.trading_status !== 'active') {
      await recordExecution({
        signalId: signal.id,
        workspaceId: signal.workspace_id,
        userId: signal.user_id,
        connectionId: account.connection_id,
        accountId: account.account_id,
        status: 'skipped_instrument_unavailable',
      });
      logger.warn(
        { signalId: signal.id, accountId: account.account_id, instrument: signal.instrument },
        'Trader signal execution skipped: instrument is unavailable',
      );
      return;
    }
    const stopLoss = signal.stop_loss == null ? null : String(signal.stop_loss);
    const takeProfit = resolveTakeProfit(signal.targets);
    const orderType = signal.order_type === 'limit' ? 'limit' : 'market';
    const orderPrice = orderType === 'limit' ? String(price) : undefined;
    const supportedOrderTypes = adapter.capabilities?.supportedOrderTypes;
    if (Array.isArray(supportedOrderTypes) && !supportedOrderTypes.includes(orderType)) {
      const warning = `Exchange ${account.exchange_code} does not support ${orderType} orders.`;
      await recordExecution({
        signalId: signal.id,
        workspaceId: signal.workspace_id,
        userId: signal.user_id,
        connectionId: account.connection_id,
        accountId: account.account_id,
        status: 'skipped_order_type_unsupported',
        errorMessage: warning,
      });
      logger.warn(
        { signalId: signal.id, accountId: account.account_id, marketType, orderType, warning },
        'Trader signal execution skipped: order type unsupported',
      );
      return;
    }
    const protectionPlan = resolveBracketProtectionPlan({
      capabilities: adapter.capabilities,
      marketType,
      orderType,
      stopLoss,
      takeProfit,
    });
    if (!protectionPlan.supported || (marketType === 'spot' && signal.direction === 'short')) {
      const warning = marketType === 'spot' && signal.direction === 'short'
        ? 'Spot accounts cannot open short positions; connect a supported futures account for short signals.'
        : protectionPlan.warning;
      await recordExecution({
        signalId: signal.id,
        workspaceId: signal.workspace_id,
        userId: signal.user_id,
        connectionId: account.connection_id,
        accountId: account.account_id,
        status: 'skipped_protection_unsupported',
        errorMessage: warning,
      });
      logger.warn(
        {
          signalId: signal.id,
          accountId: account.account_id,
          exchange: account.exchange_code,
          marketType,
          orderType,
          protectionStrategy: protectionPlan.strategy,
          warning,
        },
        'Trader signal execution skipped by TP/SL compatibility policy',
      );
      return;
    }

    const credentials = await connections.loadCredentials(account.connection_id);
    const balanceParams = {
      ...credentials,
      accountType: account.account_type,
      environment: account.environment,
    };
    const accountState = adapter.fetchAccountState
      ? await adapter.fetchAccountState(balanceParams)
      : { balances: await adapter.fetchBalances(balanceParams) };
    const quoteAsset = instrument.quote_asset;
    const baseAsset = instrument.base_asset;
    const balanceAsset = marketType === 'spot' && signal.direction === 'short'
      ? baseAsset
      : quoteAsset;
    const balance = accountState.balances?.find(
      (item) => item.asset === balanceAsset,
    );
    const availableEquity = Number(accountState.availableEquity);
    const available = marketType === 'futures' &&
      accountState.availableEquity != null &&
      Number.isFinite(availableEquity) &&
      availableEquity >= 0
      ? availableEquity
      : Number(balance?.free ?? balance?.available ?? 0);
    if (!Number.isFinite(available) || available <= 0) {
      await recordExecution({
        signalId: signal.id,
        workspaceId: signal.workspace_id,
        userId: signal.user_id,
        connectionId: account.connection_id,
        accountId: account.account_id,
        status: 'skipped_insufficient_balance',
      });
      logger.warn(
        { signalId: signal.id, accountId: account.account_id, balanceAsset },
        'Trader signal execution skipped: no available balance',
      );
      return;
    }

    const allocatedBalance = requestedAmount == null
      ? available * (percentage / 100)
      : requestedAmount;
    const quantity = requestedAmount == null && marketType === 'spot' && signal.direction === 'short'
      ? allocatedBalance
      : allocatedBalance / price;
    const leverage = Math.max(1, Number(signal.leverage) || 1);
    const requiredBalance = marketType === 'spot' && signal.direction === 'short'
      ? quantity
      : marketType === 'futures'
        ? allocatedBalance / leverage
        : allocatedBalance;
    if (requestedAmount != null && available < requiredBalance) {
      await recordExecution({
        signalId: signal.id,
        workspaceId: signal.workspace_id,
        userId: signal.user_id,
        connectionId: account.connection_id,
        accountId: account.account_id,
        status: 'skipped_insufficient_balance',
        errorMessage: `Available ${balanceAsset} balance is below the required ${formatQuantity(requiredBalance)}.`,
      });
      logger.warn(
        { signalId: signal.id, accountId: account.account_id, balanceAsset },
        'Trader signal execution skipped: selected amount exceeds available balance',
      );
      return;
    }
    const formattedQuantity = formatQuantity(quantity);
    if (!formattedQuantity) {
      await recordExecution({
        signalId: signal.id,
        workspaceId: signal.workspace_id,
        userId: signal.user_id,
        connectionId: account.connection_id,
        accountId: account.account_id,
        status: 'skipped_invalid_quantity',
      });
      logger.warn(
        { signalId: signal.id, accountId: account.account_id },
        'Trader signal execution skipped: calculated quantity is invalid',
      );
      return;
    }

    const result = await terminal.submitOrder({
      userId: signal.user_id,
      workspaceId: signal.workspace_id,
      connectionId: account.connection_id,
      accountId: account.account_id,
      marketType,
      instrumentId: signal.instrument,
      side: signal.direction === 'long' ? 'buy' : 'sell',
      type: orderType,
      quantity: formattedQuantity,
      stopLoss,
      takeProfit,
      ...(orderType === 'limit' ? { price: orderPrice } : {}),
      idempotencyKey: fnv1aHash(`trader-signal:${signal.id}:${account.account_id}`),
    });

    const executionStatus = result.requiresConfirmation
      ? 'awaiting_confirmation'
      : result.ambiguous
        ? 'reconciliation_required'
        : result.order?.status || 'failed';
    await recordExecution({
      signalId: signal.id,
      workspaceId: signal.workspace_id,
      userId: signal.user_id,
      connectionId: account.connection_id,
      accountId: account.account_id,
      executionRequestId: result.executionRequest?.id,
      orderId: result.order?.id,
      status: executionStatus,
      requestedQuantity: formattedQuantity,
    });

    const hasRejectedOrder = ['rejected', 'failed', 'canceled', 'cancelled']
      .includes(String(executionStatus).toLowerCase());
    const logFields = {
        signalId: signal.id,
        accountId: account.account_id,
        orderId: result.order?.id || null,
        requiresConfirmation: Boolean(result.requiresConfirmation),
        status: executionStatus,
      };
    if (result.requiresConfirmation) {
      logger.warn(logFields, 'Trader signal execution is awaiting explicit approval');
    } else if (
      hasRejectedOrder ||
      executionStatus === 'reconciliation_required' ||
      executionStatus === 'failed'
    ) {
      logger.warn(logFields, 'Trader signal execution did not complete successfully');
    } else {
      logger.info(logFields, 'Trader signal execution submitted');
    }
  }

  async function handleOrderFilled({ orderId }) {
    if (!orderId) return;
    await queries.updateTraderSignalExecutionByOrder(orderId, 'filled');
  }

  async function handleOrderStatus({ orderId, status }) {
    if (!orderId || !status) return;
    await queries.updateTraderSignalExecutionByOrder(orderId, status);
  }

  async function handleClosedTrade(trade) {
    if (!trade?.closedTradeId || !trade.accountId || !trade.instrument || !trade.exchangeOrderId) return;
    const execution = await queries.findSignalExecutionForClosedTrade({
      accountId: trade.accountId,
      exchangeOrderId: trade.exchangeOrderId,
      instrument: trade.instrument,
    });
    if (!execution) return;

    const realizedPnl = Number(trade.realizedPnl);
    if (!Number.isFinite(realizedPnl)) {
      logger.warn(
        { signalId: execution.signal_id, closedTradeId: trade.closedTradeId },
        'Signal performance not recorded: closed-trade PnL is invalid',
      );
      return;
    }
    const closedAt = trade.closedAt ? new Date(trade.closedAt) : new Date();
    const outcome = realizedPnl > 0 ? 'win' : realizedPnl < 0 ? 'loss' : 'breakeven';
    await db.tx(async (tx) => {
      const attributed = await queries.insertSignalExecutionClosedTrade(tx, {
        executionId: execution.id,
        closedTradeId: trade.closedTradeId,
        realizedPnl: String(trade.realizedPnl),
        pnlAsset: trade.pnlAsset || null,
        closedAt,
      });
      if (!attributed) return;
      await performance.recordObservation({
        signalId: execution.signal_id,
        observedAt: closedAt,
        outcome,
        sourceClosedTradeId: trade.closedTradeId,
        client: tx,
        evidence: {
          attribution: 'exact_exchange_order_id',
          accountId: trade.accountId,
          exchangeOrderId: trade.exchangeOrderId,
          instrument: trade.instrument,
          quantity: trade.quantity,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          realizedPnl: String(trade.realizedPnl),
          pnlAsset: trade.pnlAsset || null,
          feeAmount: trade.feeAmount,
          feeAsset: trade.feeAsset,
        },
      });
    });
  }

  return {
    executePublishedSignal,
    executeSignalForPublication,
    handleOrderFilled,
    handleOrderStatus,
    handleClosedTrade,
  };
}

async function fetchReferencePrice(marketData, exchangeCode, symbol, marketType) {
  if (marketType === 'spot' && typeof marketData?.getSpotPrice === 'function') {
    return Number(await marketData.getSpotPrice({ exchangeCode, symbol }));
  }
  if (typeof marketData?.getMarketData !== 'function') {
    throw new Error('Market data is unavailable for market-order sizing');
  }
  const data = await marketData.getMarketData({
    exchangeCode,
    symbol,
    marketType,
    timeframe: '1m',
    limit: 25,
  });
  return Number(data?.overview?.lastPrice);
}

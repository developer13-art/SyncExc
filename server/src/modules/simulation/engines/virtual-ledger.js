/**
 * SyncExc Server — Virtual ledger
 *
 * Real ledger operations: apply fills, debit/credit balances, compute
 * positions and PnL. Every mutation is idempotent and recorded.
 */

export function createVirtualLedger({ db, queries, ledgerService, logger }) {
  /**
   * Apply a fill to an account: update balances, positions, and ledger.
   */
  async function applyFill({ runId, accountId, fill, order }) {
    return db.tx(async (tx) => {
      const [baseAsset, quoteAsset] = splitInstrument(order.instrument);

      // Spot semantics for now
      if (order.marketType === 'spot') {
        if (order.side === 'buy') {
          // Increase base, decrease quote
          await adjustBalance(tx, {
            accountId,
            asset: baseAsset,
            delta: Number(fill.quantity),
          });
          await adjustBalance(tx, {
            accountId,
            asset: quoteAsset,
            delta: -Number(fill.quantity) * Number(fill.price),
          });
          await adjustBalance(tx, {
            accountId,
            asset: fill.feeAsset || quoteAsset,
            delta: -Number(fill.fee || 0),
          });
        } else {
          // Sell
          await adjustBalance(tx, {
            accountId,
            asset: baseAsset,
            delta: -Number(fill.quantity),
          });
          await adjustBalance(tx, {
            accountId,
            asset: quoteAsset,
            delta: Number(fill.quantity) * Number(fill.price),
          });
          await adjustBalance(tx, {
            accountId,
            asset: fill.feeAsset || quoteAsset,
            delta: -Number(fill.fee || 0),
          });
        }
      } else {
        // Futures: model positions
        await applyFuturesFill(tx, { runId, accountId, fill, order });
      }

      // Ledger entry
      await queries.insertLedgerEntry(tx, {
        accountId,
        asset: quoteAsset,
        amount: order.side === 'buy'
          ? (-Number(fill.quantity) * Number(fill.price)).toFixed(8)
          : (Number(fill.quantity) * Number(fill.price)).toFixed(8),
        entryType: 'fill',
        sourceType: 'simulation_fill',
        sourceId: fill.id,
        metadata: { instrument: order.instrument, price: fill.price },
      });

      // Cost event for fees
      if (Number(fill.fee || 0) > 0) {
        await queries.insertCostEvent(tx, {
          runId,
          accountId,
          costType: 'trading_fee',
          amount: fill.fee,
          asset: fill.feeAsset || quoteAsset,
          source: `order:${order.id}`,
          occurredAt: new Date(fill.executedAt),
        });
      }
    });
  }

  async function adjustBalance(tx, { accountId, asset, delta }) {
    const existing = await queries.getBalance(accountId, asset);
    const current = existing ? Number(existing.total) : 0;
    const next = current + delta;

    await queries.upsertBalance(tx, {
      accountId,
      asset,
      free: next.toFixed(8),
      used: '0',
      total: next.toFixed(8),
    });
  }

  async function applyFuturesFill(tx, { runId, accountId, fill, order }) {
    const side = order.side === 'buy' ? 'long' : 'short';
    const existing = await db.query(
      `
      SELECT * FROM simulation_positions
      WHERE run_id = $1 AND account_id = $2 AND instrument = $3 AND side = $4
      `,
      [runId, accountId, order.instrument, side]
    );

    const fillQty = Number(fill.quantity);
    const fillPrice = Number(fill.price);

    if (existing.rows.length === 0 || Number(existing.rows[0].quantity) === 0) {
      // New position
      await queries.upsertPosition(tx, {
        runId,
        accountId,
        instrument: order.instrument,
        side,
        quantity: fillQty.toFixed(8),
        entryPrice: fillPrice.toFixed(8),
        markPrice: fillPrice.toFixed(8),
        unrealizedPnl: '0',
        realizedPnl: '0',
        leverage: order.metadata?.leverage || null,
      });
      return;
    }

    // Existing position — update
    const current = existing.rows[0];
    const currentQty = Number(current.quantity);
    const currentEntry = Number(current.entry_price);

    // Same direction: add to position, recompute entry
    const newQty = currentQty + fillQty;
    const newEntry = (currentQty * currentEntry + fillQty * fillPrice) / newQty;

    await queries.upsertPosition(tx, {
      runId,
      accountId,
      instrument: order.instrument,
      side,
      quantity: newQty.toFixed(8),
      entryPrice: newEntry.toFixed(8),
      markPrice: fillPrice.toFixed(8),
      unrealizedPnl: '0',
      realizedPnl: current.realized_pnl,
      leverage: current.leverage,
    });
  }

  /**
   * Update mark price and unrealized PnL for all positions in a run.
   */
  async function markToMarket({ runId, marks }) {
    return db.tx(async (tx) => {
      const positions = await queries.listPositionsForRun(runId);
      for (const pos of positions) {
        const markPrice = marks[pos.instrument];
        if (!markPrice) continue;

        const qty = Number(pos.quantity);
        const entry = Number(pos.entry_price);
        const unrealizedPnl =
          pos.side === 'long'
            ? qty * (markPrice - entry)
            : qty * (entry - markPrice);

        await queries.upsertPosition(tx, {
          runId,
          accountId: pos.account_id,
          instrument: pos.instrument,
          side: pos.side,
          quantity: pos.quantity,
          entryPrice: pos.entry_price,
          markPrice: markPrice.toFixed(8),
          unrealizedPnl: unrealizedPnl.toFixed(8),
          realizedPnl: pos.realized_pnl,
          leverage: pos.leverage,
        });
      }
    });
  }

  function splitInstrument(instrument) {
    const parts = String(instrument).split('/');
    return [parts[0] || 'BASE', parts[1] || 'QUOTE'];
  }

  return {
    applyFill,
    markToMarket,
  };
}

export default createVirtualLedger;
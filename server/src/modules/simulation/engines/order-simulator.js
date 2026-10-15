/**
 * SyncExc Server — Order simulator
 *
 * Accepts a requested order, runs it through the fill engine, applies
 * the fill to the virtual ledger, and records everything.
 */

export function createOrderSimulator({ db, queries, fillEngine, virtualLedger, logger }) {
  /**
   * Process one simulated order against one market snapshot.
   */
  async function processOrder({
    runId,
    accountId,
    order,
    market,
    config,
  }) {
    return db.tx(async (tx) => {
      // Persist the order
      const created = await queries.insertOrder(tx, {
        runId,
        accountId,
        instrument: order.instrument,
        marketType: order.marketType,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price || null,
        status: 'validating',
        metadata: order.metadata || {},
      });

      // Execute the fill model
      const result = fillEngine.execute({
        order,
        market,
        config,
      });

      if (result.rejection) {
        await queries.updateOrder(created.id, {
          status: 'rejected',
          metadata: { rejection: result.rejection },
        });
        await queries.insertOrderEvent(tx, {
          orderId: created.id,
          eventType: 'rejected',
          payload: { reason: result.rejection },
        });

        return { order: created, fills: [], rejection: result.rejection };
      }

      // Update the order as filled
      const updated = await queries.updateOrder(created.id, {
        status: result.partial ? 'partially_filled' : 'filled',
        filledQuantity: result.filledQuantity,
        averageFillPrice: result.averageFillPrice,
      });

      await queries.insertOrderEvent(tx, {
        orderId: created.id,
        eventType: 'filled',
        payload: {
          filledQuantity: result.filledQuantity,
          averageFillPrice: result.averageFillPrice,
        },
      });

      // Persist fills
      const fills = [];
      for (const fill of result.fills) {
        const created_fill = await queries.insertFill(tx, {
          orderId: created.id,
          quantity: fill.quantity,
          price: fill.price,
          fee: fill.fee,
          feeAsset: fill.feeAsset,
          fillModel: config.fillModel || 'immediate_simplified',
          executedAt: new Date(fill.executedAt),
        });
        fills.push(created_fill);
      }

      // Apply each fill to the ledger (outside the tx, using its own tx)
      for (const fill of fills) {
        await virtualLedger.applyFill({
          runId,
          accountId,
          fill,
          order: updated,
        });
      }

      return { order: updated, fills, rejection: null };
    });
  }

  return {
    processOrder,
  };
}

export default createOrderSimulator;
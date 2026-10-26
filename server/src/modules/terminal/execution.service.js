/**
 * SyncExc Server — Execution service
 *
 * Handles execution updates from:
 *   - the exchange stream (real-time fills, order changes)
 *   - reconciliation jobs (verify exchange state when the outcome was unknown)
 *
 * All updates are idempotent. Fills are deduplicated on exchange_trade_id.
 */

import { NotFoundError } from '../../lib/errors.js';
import { ORDER_STATUS } from '@syncexc/shared';

export function createExecutionService({ db, queries, events, realtime, logger }) {
  /**
   * Handle an execution update from an exchange event.
   * Matches the order by exchangeOrderId, updates the order, and inserts
   * any new fills.
   */
  async function handleExecutionUpdate({ connectionId, update }) {
    const {
      exchangeOrderId,
      status,
      filledQuantity: reportedFilledQuantity,
      remainingQuantity,
      averageFillPrice: reportedAverageFillPrice,
      fills = [],
    } = update;
    if (!exchangeOrderId) return;
    const normalizeOptionalNumeric = (value) =>
      typeof value === 'string' && value.trim() === '' ? null : value;
    const fillQuantityFromTrades = Array.isArray(fills)
      ? fills.reduce((total, fill) => total + (Number(fill.quantity) || 0), 0)
      : 0;
    const weightedFillValue = Array.isArray(fills)
      ? fills.reduce((total, fill) => total + (Number(fill.quantity) || 0) * (Number(fill.price) || 0), 0)
      : 0;
    const filledQuantity = normalizeOptionalNumeric(reportedFilledQuantity) ??
      (fillQuantityFromTrades > 0 ? String(fillQuantityFromTrades) : null);
    const averageFillPrice = normalizeOptionalNumeric(reportedAverageFillPrice) ??
      (fillQuantityFromTrades > 0 && weightedFillValue > 0
        ? String(weightedFillValue / fillQuantityFromTrades)
        : null);

    const result = await db.query(
      `SELECT * FROM trading_orders WHERE connection_id = $1 AND exchange_order_id = $2 LIMIT 1`,
      [connectionId, exchangeOrderId]
    );
    if (result.rows.length === 0) return;
    const order = result.rows[0];

    const previousStatus = order.status;
    let newStatus = status || order.status;
    if ([ORDER_STATUS.FILLED, ORDER_STATUS.PARTIALLY_FILLED].includes(newStatus)) {
      const fillPrice = Number(averageFillPrice);
      if (
        !exchangeOrderId ||
        !Number.isFinite(fillPrice) ||
        fillPrice <= 0 ||
        !Number.isFinite(Number(filledQuantity)) ||
        Number(filledQuantity) <= 0
      ) {
        logger.warn(
          { orderId: order.id, exchangeOrderId, status: newStatus },
          'Ignoring unverified fill status without a valid order ID and fill price',
        );
        return { applied: false };
      }
    }

    await db.tx(async (tx) => {
      await queries.updateOrder(order.id, {
        status: newStatus,
        filledQuantity: filledQuantity ?? order.filled_quantity,
        remainingQuantity: remainingQuantity ?? order.remaining_quantity,
        averageFillPrice: averageFillPrice ?? order.average_fill_price,
        rejectionReason: update.errorMessage || update.rejectionReason || null,
      });

      if (previousStatus !== newStatus) {
        await queries.insertOrderEvent(tx, {
          orderId: order.id,
          eventType: 'status_changed',
          previousStatus,
          newStatus,
        });
      }

      for (const fill of fills) {
        const inserted = await queries.insertFill(tx, {
          orderId: order.id,
          workspaceId: order.workspace_id,
          exchangeTradeId: fill.exchangeTradeId,
          instrument: fill.instrument || order.instrument,
          side: fill.side || order.side,
          quantity: fill.quantity,
          price: fill.price,
          feeAmount: fill.feeAmount,
          feeAsset: fill.feeAsset,
          executedAt: fill.executedAt || new Date(),
        });

        if (inserted) {
          if (order.market_type === 'spot') {
            await queries.recordSpotFillFifo(tx, {
              fillId: inserted.id,
              order,
              fill,
            });
          }
          await events.publish(
            tx,
            newStatus === ORDER_STATUS.FILLED
              ? 'execution.order_filled'
              : 'execution.order_partially_filled',
            {
              orderId: order.id,
              fillId: inserted.id,
              quantity: inserted.quantity,
              price: inserted.price,
            },
            {
              workspaceId: order.workspace_id,
              resourceType: 'order',
              resourceId: order.id,
            }
          );
        }
      }

      if (previousStatus !== newStatus && newStatus === ORDER_STATUS.FILLED) {
        await events.publish(
          tx,
          'execution.order_filled',
          {
            orderId: order.id,
            exchangeOrderId,
            filledQuantity: filledQuantity ?? order.filled_quantity,
            averageFillPrice,
          },
          {
            workspaceId: order.workspace_id,
            resourceType: 'order',
            resourceId: order.id,
          },
        );
      } else if (previousStatus !== newStatus && newStatus === ORDER_STATUS.PARTIALLY_FILLED) {
        await events.publish(
          tx,
          'execution.order_partially_filled',
          {
            orderId: order.id,
            exchangeOrderId,
            filledQuantity: filledQuantity ?? order.filled_quantity,
            averageFillPrice,
          },
          {
            workspaceId: order.workspace_id,
            resourceType: 'order',
            resourceId: order.id,
          },
        );
      } else if (previousStatus !== newStatus && newStatus === ORDER_STATUS.REJECTED) {
        await events.publish(
          tx,
          'execution.order_rejected',
          {
            orderId: order.id,
            exchangeOrderId,
            errorCode: update.errorCode || update.code || null,
            errorMessage: update.errorMessage || update.rejectionReason || null,
          },
          {
            workspaceId: order.workspace_id,
            resourceType: 'order',
            resourceId: order.id,
          },
        );
      }
    });

    // Broadcast over WebSocket
    if (realtime) {
      realtime.broadcastToWorkspace(
        order.workspace_id,
        'execution.order_updated',
        {
          orderId: order.id,
          status: newStatus,
          filledQuantity,
          remainingQuantity,
          averageFillPrice,
        },
        { resourceType: 'order', resourceId: order.id }
      );
    }
    return { applied: true };
  }

  /**
   * Reconcile an order whose outcome was uncertain.
   */
  async function reconcileOrder({ orderId }) {
    const order = await queries.findOrderById(orderId);
    if (!order) throw new NotFoundError('Order');

    // Caller (the reconciliation job) supplies fresh state from the exchange
    // and calls handleExecutionUpdate with the corrected data.
    logger.info({ orderId }, 'Order flagged for reconciliation');
    return order;
  }

  return {
    handleExecutionUpdate,
    reconcileOrder,
  };
}

export default createExecutionService;
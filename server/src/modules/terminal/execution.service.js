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
import { compareDecimals, ORDER_STATUS } from '@syncexc/shared';

const VALID_ORDER_STATUSES = new Set(Object.values(ORDER_STATUS));
const TERMINAL_ORDER_STATUSES = new Set([
  ORDER_STATUS.FILLED,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.FAILED,
  ORDER_STATUS.CANCELED,
  ORDER_STATUS.EXPIRED,
]);

export function createExecutionService({ db, queries, events, realtime, logger }) {
  /**
   * Handle an execution update from an exchange event.
   * Matches the order by exchangeOrderId, updates the order, and inserts
   * any new fills.
   */
  async function handleExecutionUpdate({ connectionId, update }) {
    const {
      exchangeOrderId,
      clientOrderId,
      status,
      filledQuantity: reportedFilledQuantity,
      remainingQuantity,
      averageFillPrice: reportedAverageFillPrice,
      fills = [],
    } = update;
    if (!exchangeOrderId && !clientOrderId) {
      logger.warn({ status }, 'Ignoring exchange order update without an order identifier');
      return { applied: false };
    }
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
      `SELECT *
       FROM trading_orders
       WHERE connection_id = $1
         AND (
           ($2::text IS NOT NULL AND exchange_order_id = $2)
           OR ($3::text IS NOT NULL AND client_order_id = $3)
         )
       ORDER BY CASE WHEN exchange_order_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [connectionId, exchangeOrderId || null, clientOrderId || null]
    );
    if (result.rows.length === 0) return;
    const order = result.rows[0];
    if (
      (order.exchange_order_id && exchangeOrderId && order.exchange_order_id !== exchangeOrderId) ||
      (order.client_order_id && clientOrderId && order.client_order_id !== clientOrderId)
    ) {
      logger.warn(
        {
          orderId: order.id,
          expectedExchangeOrderId: order.exchange_order_id,
          actualExchangeOrderId: exchangeOrderId,
          expectedClientOrderId: order.client_order_id,
          actualClientOrderId: clientOrderId,
        },
        'Ignoring exchange update with mismatched order identity',
      );
      return { applied: false };
    }

    const previousStatus = order.status;
    const normalizedStatus = String(status || order.status).toLowerCase()
      .replace('cancelled', ORDER_STATUS.CANCELED);
    if (!VALID_ORDER_STATUSES.has(normalizedStatus)) {
      logger.warn(
        { orderId: order.id, exchangeOrderId, clientOrderId, status },
        'Ignoring unrecognized exchange order status',
      );
      return { applied: false };
    }
    let newStatus = normalizedStatus;
    if (
      previousStatus === ORDER_STATUS.FILLED &&
      normalizedStatus !== ORDER_STATUS.FILLED
    ) {
      newStatus = ORDER_STATUS.FILLED;
    } else if (
      TERMINAL_ORDER_STATUSES.has(previousStatus) &&
      normalizedStatus !== previousStatus &&
      normalizedStatus !== ORDER_STATUS.FILLED
    ) {
      newStatus = previousStatus;
    } else if (
      previousStatus === ORDER_STATUS.PARTIALLY_FILLED &&
      [ORDER_STATUS.PENDING_SUBMISSION, ORDER_STATUS.SUBMITTED, ORDER_STATUS.ACKNOWLEDGED]
        .includes(normalizedStatus)
    ) {
      newStatus = ORDER_STATUS.PARTIALLY_FILLED;
    }

    let effectiveFilledQuantity = filledQuantity ?? order.filled_quantity;
    if (
      effectiveFilledQuantity != null &&
      order.filled_quantity != null &&
      compareDecimals(String(effectiveFilledQuantity), String(order.filled_quantity)) < 0
    ) {
      effectiveFilledQuantity = order.filled_quantity;
    }
    const quantityDidNotAdvance = effectiveFilledQuantity != null &&
      order.filled_quantity != null &&
      compareDecimals(String(effectiveFilledQuantity), String(order.filled_quantity)) <= 0;
    const effectiveAverageFillPrice = quantityDidNotAdvance
      ? order.average_fill_price ?? averageFillPrice
      : averageFillPrice ?? order.average_fill_price;

    if ([ORDER_STATUS.FILLED, ORDER_STATUS.PARTIALLY_FILLED].includes(newStatus)) {
      const fillPrice = Number(effectiveAverageFillPrice);
      if (
        !(exchangeOrderId || order.exchange_order_id) ||
        !Number.isFinite(fillPrice) ||
        fillPrice <= 0 ||
        !Number.isFinite(Number(effectiveFilledQuantity)) ||
        Number(effectiveFilledQuantity) <= 0
      ) {
        logger.warn(
          { orderId: order.id, exchangeOrderId, clientOrderId, status: newStatus },
          'Ignoring unverified fill status without a valid order ID and fill price',
        );
        return { applied: false };
      }
    }

    await db.tx(async (tx) => {
      await queries.updateOrder(order.id, {
        exchangeOrderId: exchangeOrderId || order.exchange_order_id,
        status: newStatus,
        filledQuantity: effectiveFilledQuantity,
        remainingQuantity: remainingQuantity ?? order.remaining_quantity,
        averageFillPrice: effectiveAverageFillPrice,
        rejectionReason: update.errorMessage || update.rejectionReason || null,
        metadata: newStatus === ORDER_STATUS.REJECTED || newStatus === ORDER_STATUS.FAILED
          ? {
              ...(order.metadata || {}),
              ...(update.errorCode || update.code
                ? { providerErrorCode: String(update.errorCode || update.code) }
                : {}),
              ...(update.errorMessage || update.rejectionReason
                ? { lastError: update.errorMessage || update.rejectionReason }
                : {}),
            }
          : undefined,
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
              instrument: order.instrument,
              side: order.side,
              quantity: inserted.quantity,
              price: inserted.price,
              filledQuantity: effectiveFilledQuantity,
              averageFillPrice: effectiveAverageFillPrice,
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
            exchangeOrderId: exchangeOrderId || order.exchange_order_id,
            instrument: order.instrument,
            side: order.side,
            filledQuantity: effectiveFilledQuantity,
            averageFillPrice: effectiveAverageFillPrice,
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
            exchangeOrderId: exchangeOrderId || order.exchange_order_id,
            instrument: order.instrument,
            side: order.side,
            filledQuantity: effectiveFilledQuantity,
            averageFillPrice: effectiveAverageFillPrice,
          },
          {
            workspaceId: order.workspace_id,
            resourceType: 'order',
            resourceId: order.id,
          },
        );
      } else if (
        previousStatus !== newStatus &&
        [ORDER_STATUS.REJECTED, ORDER_STATUS.FAILED].includes(newStatus)
      ) {
        await events.publish(
          tx,
          'execution.order_rejected',
          {
            orderId: order.id,
            exchangeOrderId: exchangeOrderId || order.exchange_order_id,
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
          filledQuantity: effectiveFilledQuantity,
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
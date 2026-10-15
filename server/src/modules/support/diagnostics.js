/**
 * SyncExc Server — Diagnostic service
 *
 * Runs sanitized diagnostic checks on ticket-linked resources. Never
 * exposes secrets; all output goes through redaction.
 */

import { NotFoundError, ValidationError, AuthorizationError } from '../../lib/errors.js';
import { redactSensitive } from '../../lib/mask.js';

const ALLOWED_DIAGNOSTICS = new Set([
  'connection_health',
  'order_status',
  'sync_status',
  'webhook_delivery_status',
  'subscription_status',
]);

export function createDiagnosticService({ db, queries, services, logger }) {
  async function runDiagnostic({ ticketId, agentId, diagnosticType, scope }) {
    if (!ALLOWED_DIAGNOSTICS.has(diagnosticType)) {
      throw new ValidationError(`Unsupported diagnostic: ${diagnosticType}`);
    }

    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    // Create the run
    const run = await db.tx(async (tx) => {
      return queries.insertDiagnosticRun(tx, {
        ticketId,
        requestedBy: agentId,
        diagnosticType,
        scope,
      });
    });

    let result;
    let error = null;

    try {
      result = await executeDiagnostic({ diagnosticType, scope, ticket });
    } catch (err) {
      error = err.message;
      logger.warn({ err, diagnosticType, ticketId }, 'Diagnostic failed');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateDiagnosticRun(run.id, {
        status: error ? 'failed' : 'completed',
        completedAt: new Date(),
      });

      const sanitized = redactSensitive(result || { error });

      await queries.insertDiagnosticResult(tx, {
        runId: run.id,
        result: sanitized,
        sanitized: true,
      });

      await queries.insertAuditEvent(tx, {
        actorId: agentId,
        ticketId,
        action: `diagnostic.${diagnosticType}`,
        resourceType: 'support_diagnostic',
        resourceId: run.id,
        after: { status: updated.status, scope },
      });

      return { run: updated, result: sanitized, error };
    });
  }

  async function executeDiagnostic({ diagnosticType, scope, ticket }) {
    switch (diagnosticType) {
      case 'connection_health': {
        const connectionId = scope.connectionId;
        if (!connectionId) throw new ValidationError('connectionId required');
        const health = await db.query(
          `
          SELECT state, last_successful_request, last_successful_sync, last_error, latency_ms, updated_at
          FROM exchange_connection_health
          WHERE connection_id = $1
          `,
          [connectionId]
        );
        const connection = await db.query(
          `SELECT exchange_code, environment, status FROM exchange_connections WHERE id = $1`,
          [connectionId]
        );
        return {
          connection: connection.rows[0] || null,
          health: health.rows[0] || null,
        };
      }

      case 'order_status': {
        const orderId = scope.orderId;
        if (!orderId) throw new ValidationError('orderId required');
        const order = await db.query(
          `
          SELECT id, instrument, side, type, quantity, filled_quantity, status,
                 rejection_reason, created_at, updated_at
          FROM trading_orders
          WHERE id = $1
          `,
          [orderId]
        );
        const events = await db.query(
          `
          SELECT event_type, new_status, occurred_at
          FROM trading_order_events
          WHERE order_id = $1
          ORDER BY occurred_at DESC
          LIMIT 20
          `,
          [orderId]
        );
        return {
          order: order.rows[0] || null,
          recentEvents: events.rows,
        };
      }

      case 'sync_status': {
        const operationId = scope.operationId;
        if (!operationId) throw new ValidationError('operationId required');
        const operation = await db.query(
          `SELECT * FROM sync_operations WHERE id = $1`,
          [operationId]
        );
        const destinations = await db.query(
          `
          SELECT id, status, filled_quantity, error_code, error_message, updated_at
          FROM sync_destination_operations
          WHERE operation_id = $1
          `,
          [operationId]
        );
        return {
          operation: operation.rows[0] || null,
          destinations: destinations.rows,
        };
      }

      case 'webhook_delivery_status': {
        const deliveryId = scope.deliveryId;
        if (!deliveryId) throw new ValidationError('deliveryId required');
        const delivery = await db.query(
          `SELECT * FROM developer_webhook_deliveries WHERE id = $1`,
          [deliveryId]
        );
        const attempts = await db.query(
          `
          SELECT attempt_number, response_status, duration_ms, error_message, completed_at
          FROM developer_webhook_delivery_attempts
          WHERE delivery_id = $1
          ORDER BY attempt_number DESC
          LIMIT 10
          `,
          [deliveryId]
        );
        return {
          delivery: delivery.rows[0] || null,
          attempts: attempts.rows,
        };
      }

      case 'subscription_status': {
        const subscriptionId = scope.subscriptionId;
        if (!subscriptionId) throw new ValidationError('subscriptionId required');
        const sub = await db.query(
          `SELECT * FROM subscriptions WHERE id = $1`,
          [subscriptionId]
        );
        return { subscription: sub.rows[0] || null };
      }

      default:
        throw new ValidationError(`Unsupported diagnostic: ${diagnosticType}`);
    }
  }

  async function listDiagnosticRuns({ ticketId, agentId }) {
    // In practice we check agent permissions via middleware
    return queries.listDiagnosticRuns(ticketId);
  }

  return {
    runDiagnostic,
    listDiagnosticRuns,
    ALLOWED_DIAGNOSTICS,
  };
}

export default createDiagnosticService;
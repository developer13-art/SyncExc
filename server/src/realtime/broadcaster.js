/**
 * SyncExc Server — Broadcaster
 *
 * Translates domain events into WebSocket messages and delivers them to the
 * correct channels:
 *   - events with a workspaceId → broadcast to `workspace:<id>`
 *   - events with an actorId     → broadcast to `user:<actorId>`
 *   - explicit overrides via the mapping table
 *
 * The broadcaster also provides imperative helpers:
 *   broadcastToUser(userId, type, payload)
 *   broadcastToWorkspace(workspaceId, type, payload)
 */

import { createLogger } from '../lib/logger.js';

/**
 * Events mapped to workspace-wide broadcast. Everything not in this list is
 * still eligible for user-scoped broadcast if it has an actorId, but these
 * are always broadcast to the entire workspace so multiple clients see them
 * in real time.
 */
const WORKSPACE_BROADCAST_EVENTS = new Set([
  'sync.operation_created',
  'sync.operation_dispatched',
  'sync.operation_completed',
  'sync.operation_failed',
  'sync.reconciliation_required',
  'sync.reconciliation_completed',
  'sync.group_paused',
  'sync.group_resumed',
  'risk.evaluated',
  'risk.blocked',
  'risk.approval_requested',
  'risk.approval_granted',
  'risk.approval_rejected',
  'risk.circuit_breaker_activated',
  'risk.emergency_pause_requested',
  'risk.emergency_pause_active',
  'risk.emergency_pause_resumed',
  'risk.incident_created',
  'risk.incident_resolved',
  'execution.order_acknowledged',
  'execution.order_partially_filled',
  'execution.order_filled',
  'execution.order_rejected',
  'execution.order_canceled',
  'execution.outcome_uncertain',
  'connection.degraded',
  'connection.reauth_required',
  'connection.disconnected',
  'source.health_changed',
  'source.activated',
  'source.paused',
  'signal.message_received',
  'signal.candidate_created',
  'signal.eligible',
  'signal.blocked',
  'signal.review_required',
  'automation.run_started',
  'automation.run_completed',
  'automation.run_failed',
  'automation.approval_required',
  'simulation.run_started',
  'simulation.run_completed',
  'simulation.run_failed',
  'workflow.published',
  'workflow.activated',
  'workflow.paused',
]);

/**
 * Events mapped to user-only broadcast, regardless of workspace.
 */
const USER_BROADCAST_EVENTS = new Set([
  'user.registered',
  'user.email_verified',
  'user.password_changed',
  'user.mfa_enabled',
  'user.mfa_disabled',
  'user.session_created',
  'user.session_revoked',
  'user.restricted',
  'user.restored',
  'billing.subscription_created',
  'billing.subscription_activated',
  'billing.subscription_renewed',
  'billing.subscription_canceled',
  'billing.subscription_expired',
  'billing.payment_succeeded',
  'billing.payment_failed',
  'billing.refund_completed',
  'referral.commission_accrued',
  'referral.payout_processed',
  'notification.created',
  'notification.delivered',
  'support.ticket_created',
  'support.ticket_assigned',
  'support.ticket_escalated',
  'support.ticket_resolved',
  'support.ticket_reopened',
]);

export function createBroadcaster({ rooms, logger: injectedLogger, events }) {
  const logger = injectedLogger || createLogger({ component: 'realtime:broadcaster' });

  return {
    /**
     * Called by the event bus for every emitted event.
     * Fans the event out over WebSocket if it is eligible.
     */
    handleEvent(envelope) {
      if (!envelope || !envelope.eventType) return;

      const message = {
        type: 'event',
        channel: null, // filled per broadcast
        eventType: envelope.eventType,
        payload: envelope.payload,
        resourceType: envelope.resourceType,
        resourceId: envelope.resourceId,
        occurredAt: envelope.occurredAt,
        correlationId: envelope.correlationId,
      };

      // 1. User-scoped broadcast for events with an actorId OR in the user map
      if (envelope.actorId && (USER_BROADCAST_EVENTS.has(envelope.eventType) || !WORKSPACE_BROADCAST_EVENTS.has(envelope.eventType))) {
        this.broadcastToUser(envelope.actorId, envelope.eventType, envelope.payload, {
          resourceType: envelope.resourceType,
          resourceId: envelope.resourceId,
          occurredAt: envelope.occurredAt,
        });
      }

      // 2. Workspace-scoped broadcast for events in the workspace set
      if (envelope.workspaceId && WORKSPACE_BROADCAST_EVENTS.has(envelope.eventType)) {
        this.broadcastToWorkspace(envelope.workspaceId, envelope.eventType, envelope.payload, {
          resourceType: envelope.resourceType,
          resourceId: envelope.resourceId,
          occurredAt: envelope.occurredAt,
        });
      }
    },

    /**
     * Send an arbitrary message to a specific channel.
     */
    broadcast(channel, type, payload) {
      const message = {
        type: 'event',
        channel,
        eventType: type,
        payload,
        occurredAt: new Date().toISOString(),
      };
      const delivered = rooms.sendToChannel(channel, message);
      logger.trace({ channel, type, delivered }, 'Broadcast on channel');
      return delivered;
    },

    /**
     * Send to every connection belonging to a user.
     */
    broadcastToUser(userId, type, payload, extra = {}) {
      const message = {
        type: 'event',
        channel: `user:${userId}`,
        eventType: type,
        payload,
        occurredAt: extra.occurredAt || new Date().toISOString(),
        resourceType: extra.resourceType,
        resourceId: extra.resourceId,
      };
      const delivered = rooms.sendToChannel(`user:${userId}`, message);
      logger.trace({ userId, type, delivered }, 'Broadcast to user');
      return delivered;
    },

    /**
     * Send to every connection in a workspace.
     */
    broadcastToWorkspace(workspaceId, type, payload, extra = {}) {
      const message = {
        type: 'event',
        channel: `workspace:${workspaceId}`,
        eventType: type,
        payload,
        occurredAt: extra.occurredAt || new Date().toISOString(),
        resourceType: extra.resourceType,
        resourceId: extra.resourceId,
      };
      const delivered = rooms.sendToChannel(`workspace:${workspaceId}`, message);
      logger.trace({ workspaceId, type, delivered }, 'Broadcast to workspace');
      return delivered;
    },
  };
}

export default createBroadcaster;
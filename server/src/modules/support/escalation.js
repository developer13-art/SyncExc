/**
 * SyncExc Server — Escalation service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

const VALID_CATEGORIES = [
  'technical',
  'execution_integrity',
  'risk_safety',
  'security',
  'billing',
  'developer_integration',
  'platform_incident',
];

export function createEscalationService({ db, queries, events, logger }) {
  async function escalateTicket({ ticketId, category, escalatedTo, reason, actorId }) {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new ValidationError(`Invalid escalation category: ${category}`);
    }

    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    if (['closed', 'canceled'].includes(ticket.status)) {
      throw new ConflictError('Cannot escalate a closed ticket');
    }

    return db.tx(async (tx) => {
      const escalation = await queries.insertEscalation(tx, {
        ticketId,
        policyId: null,
        category,
        escalatedTo,
        reason,
      });

      const updated = await queries.updateTicket(ticketId, {
        status: 'escalated',
        assignedToId: escalatedTo || ticket.assigned_to_id,
      });

      await queries.insertStatusHistory(tx, {
        ticketId,
        previousStatus: ticket.status,
        newStatus: 'escalated',
        actorId,
        reason: `escalated:${category} — ${reason}`,
      });

      await events.publish(
        tx,
        'support.ticket_escalated',
        {
          ticketId,
          reference: ticket.reference,
          category,
          escalatedTo,
          reason,
        },
        {
          actorId,
          workspaceId: ticket.workspace_id,
          resourceType: 'support_ticket',
          resourceId: ticketId,
        }
      );

      return { escalation, ticket: updated };
    });
  }

  async function resolveEscalation({ escalationId, actorId }) {
    return db.tx(async (tx) => {
      const resolved = await queries.resolveEscalation(escalationId);
      if (!resolved) throw new NotFoundError('Escalation');

      await queries.insertAuditEvent(tx, {
        actorId,
        ticketId: resolved.ticket_id,
        action: 'escalation.resolved',
        resourceType: 'support_escalation',
        resourceId: escalationId,
      });

      return resolved;
    });
  }

  return {
    escalateTicket,
    resolveEscalation,
  };
}

export default createEscalationService;
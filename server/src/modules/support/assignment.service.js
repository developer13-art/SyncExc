/**
 * SyncExc Server — Assignment service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createAssignmentService({ db, queries, events, logger }) {
  async function assignTicket({ ticketId, assignedToId, queueId, assignedBy }) {
    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    if (['closed', 'canceled'].includes(ticket.status)) {
      throw new ConflictError('Cannot assign a closed ticket');
    }

    return db.tx(async (tx) => {
      // Create assignment record
      const assignment = await queries.insertAssignment(tx, {
        ticketId,
        assignedToId,
        queueId,
        assignedBy,
      });

      // Update ticket
      const updated = await queries.updateTicket(ticketId, {
        assignedToId: assignedToId || ticket.assigned_to_id,
        queueId: queueId || ticket.queue_id,
        status: ticket.status === 'new' ? 'assigned' : ticket.status,
      });

      // Record status change if it changed
      if (ticket.status === 'new') {
        await queries.insertStatusHistory(tx, {
          ticketId,
          previousStatus: 'new',
          newStatus: 'assigned',
          actorId: assignedBy,
          reason: 'auto_assigned_on_first_assignment',
        });
      }

      await events.publish(
        tx,
        'support.ticket_assigned',
        {
          ticketId,
          reference: ticket.reference,
          assignedToId,
          assignedBy,
        },
        {
          actorId: assignedBy,
          workspaceId: ticket.workspace_id,
          resourceType: 'support_ticket',
          resourceId: ticketId,
        }
      );

      return { assignment, ticket: updated };
    });
  }

  async function claimTicket({ ticketId, agentId }) {
    return assignTicket({
      ticketId,
      assignedToId: agentId,
      assignedBy: agentId,
    });
  }

  async function releaseTicket({ ticketId, agentId }) {
    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    if (ticket.assigned_to_id !== agentId) {
      throw new ConflictError('Ticket is not assigned to you', 'NOT_ASSIGNED');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateTicket(ticketId, {
        assignedToId: null,
        status: 'open',
      });

      await queries.insertStatusHistory(tx, {
        ticketId,
        previousStatus: ticket.status,
        newStatus: 'open',
        actorId: agentId,
        reason: 'agent_released',
      });

      return updated;
    });
  }

  return {
    assignTicket,
    claimTicket,
    releaseTicket,
  };
}

export default createAssignmentService;
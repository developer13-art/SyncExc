/**
 * SyncExc Server — Ticket service
 */

import { randomBytes } from 'node:crypto';
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from '../../lib/errors.js';
import { TICKET_STATUS } from '@syncexc/shared';

function generateReference() {
  const year = new Date().getFullYear();
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `SC-${year}-${rand}`;
}

const VALID_STATUS_TRANSITIONS = {
  new: ['open', 'assigned', 'escalated', 'canceled'],
  open: ['assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_internal_team', 'escalated', 'resolved', 'canceled'],
  assigned: ['in_progress', 'waiting_for_customer', 'waiting_for_internal_team', 'escalated', 'resolved', 'canceled'],
  in_progress: ['waiting_for_customer', 'waiting_for_internal_team', 'escalated', 'resolved', 'canceled'],
  waiting_for_customer: ['in_progress', 'resolved', 'closed', 'canceled'],
  waiting_for_internal_team: ['in_progress', 'escalated', 'resolved', 'canceled'],
  escalated: ['in_progress', 'waiting_for_internal_team', 'resolved', 'canceled'],
  resolved: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_internal_team', 'escalated', 'resolved'],
  canceled: [],
};

export function createTicketService({ db, queries, slaService, events, realtime, logger }) {
  /**
   * Create a new ticket.
   */
  async function createTicket({
    userId,
    workspaceId,
    subject,
    category,
    issueType,
    description,
    impact,
    priority,
    affectedResource,
    occurrenceTime,
    preferredLanguage,
  }) {
    if (!subject || !category || !description) {
      throw new ValidationError('subject, category, and description are required');
    }
    if (description.length < 20) {
      throw new ValidationError('Description must be at least 20 characters');
    }

    const reference = generateReference();

    const ticket = await db.tx(async (tx) => {
      const created = await queries.insertTicket(tx, {
        reference,
        requesterId: userId,
        workspaceId,
        subject,
        category,
        issueType,
        description,
        impact,
        priority: priority || 'normal',
        affectedResource,
        occurrenceTime,
        preferredLanguage,
      });

      await queries.insertStatusHistory(tx, {
        ticketId: created.id,
        newStatus: 'new',
        actorId: userId,
        reason: 'ticket_created',
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        ticketId: created.id,
        action: 'ticket.created',
        resourceType: 'support_ticket',
        resourceId: created.id,
        after: { reference, subject, category },
      });

      await queries.insertUsageEvent(tx, {
        workspaceId,
        ticketId: created.id,
        metric: 'ticket_created',
        amount: 1,
      });

      return created;
    });

    // Start SLA target
    await slaService.startTargets({ ticketId: ticket.id, priority: ticket.priority });

    await events.publish(db, 'support.ticket_created', {
      ticketId: ticket.id,
      reference: ticket.reference,
      subject: ticket.subject,
      category: ticket.category,
      userId,
      workspaceId,
    }, {
      actorId: userId,
      workspaceId,
      resourceType: 'support_ticket',
      resourceId: ticket.id,
    });

    return ticket;
  }

  async function getTicket(ticketId) {
    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    return ticket;
  }

  /**
   * Assert that the caller may access the ticket. Requesters can access their
   * own tickets; agents with queue access can access queue tickets.
   */
  async function requireAccess({ userId, ticketId, asAgent = false }) {
    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    if (asAgent) {
      // In practice, the caller's permissions determine access; here we
      // assume the caller has already passed the permission middleware.
      return ticket;
    }

    if (ticket.requester_id !== userId) {
      throw new AuthorizationError('Not permitted');
    }

    return ticket;
  }

  async function listTicketsForRequester({ userId, status, limit, cursor }) {
    return queries.listTicketsForRequester(userId, { status, limit, cursor });
  }

  async function listTicketsForAgent({ queueIds, status, priority, limit, cursor }) {
    return queries.listTicketsForQueues({ queueIds, status, priority, limit, cursor });
  }

  async function listCategories() {
    return queries.listCategories();
  }

  async function updateTicket({ userId, ticketId, updates, asAgent = false }) {
    const ticket = await requireAccess({ userId, ticketId, asAgent });
    if (ticket.status === 'closed' && updates.status && updates.status !== 'reopened') {
      throw new ConflictError('Ticket is closed', 'TICKET_CLOSED');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateTicket(ticketId, {
        subject: updates.subject,
        priority: updates.priority,
        status: updates.status,
      });

      if (updates.status && updates.status !== ticket.status) {
        await queries.insertStatusHistory(tx, {
          ticketId,
          previousStatus: ticket.status,
          newStatus: updates.status,
          actorId: userId,
          reason: updates.reason,
        });
      }

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        ticketId,
        action: 'ticket.updated',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        before: { status: ticket.status, priority: ticket.priority },
        after: updates,
      });

      return updated;
    });
  }

  async function transitionStatus({ userId, ticketId, newStatus, reason, asAgent = false }) {
    const ticket = await requireAccess({ userId, ticketId, asAgent });

    const allowed = VALID_STATUS_TRANSITIONS[ticket.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictError(
        `Cannot transition from ${ticket.status} to ${newStatus}`,
        'INVALID_TRANSITION'
      );
    }

    const extras = {};
    if (newStatus === 'resolved') {
      extras.resolvedAt = new Date();
    }
    if (newStatus === 'closed') {
      extras.closedAt = new Date();
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateTicket(ticketId, {
        status: newStatus,
        resolvedAt: extras.resolvedAt,
        closedAt: extras.closedAt,
      });

      await queries.insertStatusHistory(tx, {
        ticketId,
        previousStatus: ticket.status,
        newStatus,
        actorId: userId,
        reason,
      });

      await events.publish(
        tx,
        newStatus === 'resolved' ? 'support.ticket_resolved' : `support.ticket_${newStatus}`,
        {
          ticketId,
          reference: ticket.reference,
          previousStatus: ticket.status,
          newStatus,
          reason,
        },
        {
          actorId: userId,
          workspaceId: ticket.workspace_id,
          resourceType: 'support_ticket',
          resourceId: ticketId,
        }
      );

      return updated;
    });
  }

  async function reopenTicket({ userId, ticketId, reason }) {
    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    if (ticket.requester_id !== userId && !reason) {
      throw new AuthorizationError('Not permitted');
    }
    if (!['resolved', 'closed'].includes(ticket.status)) {
      throw new ConflictError('Ticket is not in a reopenable state', 'NOT_REOPENABLE');
    }

    return db.tx(async (tx) => {
      const updated = await queries.updateTicket(ticketId, {
        status: 'reopened',
        resolvedAt: null,
        closedAt: null,
      });

      await queries.insertStatusHistory(tx, {
        ticketId,
        previousStatus: ticket.status,
        newStatus: 'reopened',
        actorId: userId,
        reason,
      });

      await events.publish(
        tx,
        'support.ticket_reopened',
        { ticketId, reference: ticket.reference, reason },
        {
          actorId: userId,
          workspaceId: ticket.workspace_id,
          resourceType: 'support_ticket',
          resourceId: ticketId,
        }
      );

      return updated;
    });
  }

  return {
    createTicket,
    getTicket,
    requireAccess,
    listTicketsForRequester,
    listTicketsForAgent,
    listCategories,
    updateTicket,
    transitionStatus,
    reopenTicket,
  };
}

export default createTicketService;
/**
 * SyncExc Server — Conversation service
 */

import { NotFoundError, AuthorizationError } from '../../lib/errors.js';

export function createConversationService({ db, queries, ticketService, events, realtime, logger }) {
  async function postCustomerReply({ userId, ticketId, content, attachmentIds }) {
    const ticket = await ticketService.requireAccess({ userId, ticketId });

    if (['closed', 'canceled'].includes(ticket.status)) {
      throw new Error('Cannot reply to a closed or canceled ticket');
    }

    return db.tx(async (tx) => {
      const message = await queries.insertMessage(tx, {
        ticketId,
        authorId: userId,
        content,
      });

      // If the ticket was waiting for the customer, transition it back
      if (ticket.status === 'waiting_for_customer') {
        await queries.updateTicket(ticketId, { status: 'in_progress' });
        await queries.insertStatusHistory(tx, {
          ticketId,
          previousStatus: ticket.status,
          newStatus: 'in_progress',
          actorId: userId,
          reason: 'customer_replied',
        });
      }

      // Record first response if this is the customer's initial follow-up
      if (ticket.first_response_at === null) {
        // Customer messages do NOT count as support first response
      }

      return message;
    }).then((message) => {
      if (realtime) {
        realtime.broadcast(`ticket:${ticketId}`, 'support.message_created', {
          messageId: message.id,
          ticketId,
          authorId: userId,
        });
      }
      return message;
    });
  }

  /**
   * Agent reply (customer-visible).
   */
  async function postAgentReply({ agentId, ticketId, content }) {
    const ticket = await ticketService.getTicket(ticketId);

    if (['closed', 'canceled'].includes(ticket.status)) {
      throw new Error('Cannot reply to a closed or canceled ticket');
    }

    return db.tx(async (tx) => {
      const message = await queries.insertMessage(tx, {
        ticketId,
        authorId: agentId,
        content,
      });

      // Record first response time if not already set
      const updates = {};
      if (!ticket.first_response_at) {
        updates.firstResponseAt = new Date();
      }
      // Auto-transition waiting statuses to in_progress
      if (['waiting_for_customer', 'waiting_for_internal_team'].includes(ticket.status)) {
        updates.status = 'in_progress';
      }

      if (Object.keys(updates).length > 0) {
        await queries.updateTicket(ticketId, updates);
      }

      if (updates.firstResponseAt) {
        await events.publish(
          tx,
          'support.ticket_assigned',
          {
            ticketId,
            reference: ticket.reference,
            agentId,
            firstResponseAt: updates.firstResponseAt.toISOString(),
          },
          {
            actorId: agentId,
            workspaceId: ticket.workspace_id,
            resourceType: 'support_ticket',
            resourceId: ticketId,
          }
        );
      }

      return message;
    }).then((message) => {
      if (realtime) {
        realtime.broadcast(`ticket:${ticketId}`, 'support.message_created', {
          messageId: message.id,
          ticketId,
          authorId: agentId,
        });
      }
      return message;
    });
  }

  /**
   * Internal note — never visible to customer.
   */
  async function addInternalNote({ agentId, ticketId, content, mentions }) {
    return db.tx(async (tx) => {
      const note = await queries.insertInternalNote(tx, {
        ticketId,
        authorId: agentId,
        content,
        mentions,
      });
      return note;
    });
  }

  async function listMessages({ ticketId, userId, asAgent }) {
    await ticketService.requireAccess({ userId, ticketId, asAgent });
    return queries.listMessages(ticketId);
  }

  async function listInternalNotes({ ticketId }) {
    return queries.listInternalNotes(ticketId);
  }

  return {
    postCustomerReply,
    postAgentReply,
    addInternalNote,
    listMessages,
    listInternalNotes,
  };
}

export default createConversationService;
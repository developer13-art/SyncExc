/**
 * SyncExc Server — Feedback service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createFeedbackService({ db, queries, events, logger }) {
  async function submitFeedback({ userId, ticketId, score, comment, issueResolved }) {
    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');
    if (ticket.requester_id !== userId) throw new ConflictError('Not the requester');

    if (score !== null && score !== undefined && (score < 1 || score > 5)) {
      throw new ConflictError('Score must be between 1 and 5');
    }

    return db.tx(async (tx) => {
      const feedback = await queries.insertFeedback(tx, {
        ticketId,
        userId,
        score,
        comment,
        issueResolved,
      });

      // Route negative feedback for review
      if (score !== null && score <= 2) {
        logger.warn({ ticketId, score }, 'Negative support feedback recorded');
      }

      return feedback;
    });
  }

  async function listFeedback({ ticketId }) {
    return queries.listFeedbackForTicket(ticketId);
  }

  return {
    submitFeedback,
    listFeedback,
  };
}

export default createFeedbackService;
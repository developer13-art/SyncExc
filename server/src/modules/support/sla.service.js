/**
 * SyncExc Server — SLA service
 *
 * Records response targets and computes breaches. Real timing, real clocks,
 * real event records.
 */

export function createSlaService({ db, queries, events, logger }) {
  /**
   * Start the response target clock for a ticket.
   */
  async function startTargets({ ticketId, priority }) {
    const target = await queries.findResponseTarget(priority);
    if (!target) {
      logger.debug({ priority, ticketId }, 'No SLA target configured for priority');
      return null;
    }

    return db.tx(async (tx) => {
      const event = await queries.insertTargetEvent(tx, {
        ticketId,
        targetType: 'first_response',
        eventType: 'started',
        breached: false,
      });

      await queries.insertTargetEvent(tx, {
        ticketId,
        targetType: 'resolution',
        eventType: 'started',
        breached: false,
      });

      return event;
    });
  }

  /**
   * Record the first human response. Marks the target as met.
   */
  async function recordFirstResponse(ticketId) {
    return db.tx(async (tx) => {
      const event = await queries.insertTargetEvent(tx, {
        ticketId,
        targetType: 'first_response',
        eventType: 'met',
        breached: false,
      });
      return event;
    });
  }

  /**
   * Evaluate a ticket for breach. Called periodically by a job.
   */
  async function evaluateBreaches({ ticketId }) {
    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) return null;
    if (['resolved', 'closed', 'canceled'].includes(ticket.status)) return null;
    if (ticket.first_response_at) return null;

    const target = await queries.findResponseTarget(ticket.priority);
    if (!target) return null;

    const ageMinutes = (Date.now() - new Date(ticket.created_at).getTime()) / 60000;
    const breached = ageMinutes > target.first_response_minutes;

    if (breached) {
      // Check whether we've already recorded the breach
      const existing = await db.query(
        `
        SELECT 1 FROM support_target_events
        WHERE ticket_id = $1 AND target_type = 'first_response' AND event_type = 'breached'
        `,
        [ticketId]
      );
      if (existing.rows.length > 0) return { alreadyBreached: true };

      await db.tx(async (tx) => {
        await queries.insertTargetEvent(tx, {
          ticketId,
          targetType: 'first_response',
          eventType: 'breached',
          breached: true,
        });
      });

      await events.publish(db, 'support.ticket_escalated', {
        ticketId,
        reference: ticket.reference,
        reason: 'first_response_target_breached',
      }, {
        resourceType: 'support_ticket',
        resourceId: ticketId,
      });

      return { breached: true, ageMinutes };
    }

    return { breached: false, ageMinutes };
  }

  /**
   * Run a global sweep of ticket breaches. Called periodically.
   */
  async function sweepBreaches({ limit = 500 } = {}) {
    const result = await db.query(
      `
      SELECT id FROM support_tickets
      WHERE status NOT IN ('resolved', 'closed', 'canceled')
        AND first_response_at IS NULL
        AND created_at < now() - interval '1 hour'
      ORDER BY created_at ASC
      LIMIT $1
      `,
      [limit]
    );

    let breached = 0;
    for (const row of result.rows) {
      const outcome = await evaluateBreaches({ ticketId: row.id });
      if (outcome?.breached) breached += 1;
    }

    return { evaluated: result.rows.length, breached };
  }

  return {
    startTargets,
    recordFirstResponse,
    evaluateBreaches,
    sweepBreaches,
  };
}

export default createSlaService;
/**
 * SyncExc Server — Automation event listeners
 *
 * Wires trigger types to the workflow engine. When a trigger-type event
 * fires, this listener creates a run for every matching workflow.
 */

export function createAutomationListeners({ events, triggerService, executionEngine, logger }) {
  // Map trigger types to event types
  const eventMap = triggerService.TRIGGER_EVENT_MAP;

  for (const [triggerType, eventType] of Object.entries(eventMap)) {
    events.subscribe(
      eventType,
      async (envelope) => {
        try {
          // Dispatch the trigger to workflows listening on this type
          await triggerService.dispatch({
            triggerType,
            eventPayload: envelope.payload || {},
            eventId: envelope.eventId,
          });
        } catch (err) {
          logger.error(
            { err, triggerType, eventType, eventId: envelope.eventId },
            'Trigger dispatch failed'
          );
        }
      },
      { name: `automation:trigger:${triggerType}` }
    );
  }

  // Schedule-driven runs: when a schedule fires, create a run
  events.subscribe(
    'automation.schedule_fired',
    async (envelope) => {
      const { workflowId, versionId } = envelope.payload || {};
      if (!workflowId || !versionId) return;
      try {
        await executionEngine.createRun({
          workflowId,
          versionId,
          input: { triggerSource: 'schedule' },
          correlationId: envelope.correlationId,
        });
      } catch (err) {
        logger.error({ err, workflowId }, 'Failed to create scheduled run');
      }
    },
    { name: 'automation:schedule-fire' }
  );

  // Trigger-driven runs: when a trigger fires, create a run
  events.subscribe(
    'automation.trigger_fired',
    async (envelope) => {
      const { workflowId, eventPayload, eventId } = envelope.payload || {};
      if (!workflowId) return;

      try {
        const workflow = await executionEngine.queries?.findWorkflowById?.(workflowId);
        if (!workflow) return;

        const version = await executionEngine.queries?.findPublishedVersion?.(workflowId);
        if (!version) {
          logger.warn({ workflowId }, 'No published version for trigger');
          return;
        }

        await executionEngine.createRun({
          workflowId,
          versionId: version.id,
          input: { triggerEvent: eventPayload },
          triggerEventId: eventId,
          correlationId: envelope.correlationId,
        });
      } catch (err) {
        logger.error({ err, workflowId }, 'Failed to create trigger-driven run');
      }
    },
    { name: 'automation:trigger-run' }
  );

  logger.debug({ triggerTypes: Object.keys(eventMap).length }, 'Automation event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createAutomationListeners;
/**
 * SyncExc Server — Trigger service
 *
 * Registers event listeners for each trigger type. When the matching event
 * fires, the trigger creates a run for every workflow listening.
 */

export function createTriggerService({ db, queries, events, logger }) {
  const TRIGGER_EVENT_MAP = {
    signal_published: 'marketplace.signal_published',
    signal_validated: 'signal.eligible',
    source_status_changed: 'source.health_changed',
    exchange_connection_event: 'connection.status_changed',
    sync_operation_event: 'sync.operation_completed',
    risk_event: 'risk.evaluated',
    circuit_breaker_activated: 'risk.circuit_breaker_activated',
    workspace_pause_event: 'risk.emergency_pause_active',
    webhook: 'automation.webhook_received',
  };

  async function registerTriggers({ userId, workspaceId, workflowId, versionId, triggers }) {
    return db.tx(async (tx) => {
      const created = [];
      for (const trigger of triggers) {
        const t = await queries.insertTrigger(tx, {
          workflowId,
          versionId,
          triggerType: trigger.type,
          config: trigger.config || {},
        });
        created.push(t);
      }
      return created;
    });
  }

  async function listTriggers({ workspaceId, workflowId }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) return [];
    return queries.listTriggersForWorkflow(workflowId);
  }

  /**
   * Called by the listener when a trigger-type event fires. Dispatches
   * runs to every matching workflow.
   */
  async function dispatch({ triggerType, eventPayload, eventId }) {
    const triggers = await queries.findTriggersByType(triggerType);

    for (const trigger of triggers) {
      const config = trigger.config || {};

      // Optional filters
      if (config.filter) {
        const matches = evaluateFilter(config.filter, eventPayload);
        if (!matches) continue;
      }

      try {
        await events.publish(
          db,
          'automation.trigger_fired',
          {
            triggerId: trigger.id,
            workflowId: trigger.workflow_id,
            triggerType,
            eventPayload,
            eventId,
          },
          {
            workspaceId: trigger.workspace_id,
            resourceType: 'automation_trigger',
            resourceId: trigger.id,
          }
        );
      } catch (err) {
        logger.error({ err, triggerId: trigger.id }, 'Failed to dispatch trigger');
      }
    }
  }

  function evaluateFilter(filter, payload) {
    if (!filter || typeof filter !== 'object') return true;
    for (const [key, expected] of Object.entries(filter)) {
      const actual = getNestedValue(payload, key);
      if (Array.isArray(expected)) {
        if (!expected.map(String).includes(String(actual))) return false;
      } else if (String(actual) !== String(expected)) {
        return false;
      }
    }
    return true;
  }

  function getNestedValue(obj, path) {
    if (!path) return undefined;
    const parts = String(path).split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur == null) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  return {
    registerTriggers,
    listTriggers,
    dispatch,
    TRIGGER_EVENT_MAP,
  };
}

export default createTriggerService;
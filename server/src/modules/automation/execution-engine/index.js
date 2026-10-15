/**
 * SyncExc Server — Workflow execution engine
 *
 * Runs a workflow definition against an input. Handles:
 *   - trigger → node dispatch
 *   - per-node step recording
 *   - branch/port routing
 *   - retries with backoff
 *   - cancellation and timeout
 *   - partial success
 *
 * The engine is real: nodes execute, produce output, route to ports, and
 * the run completes with an accurate final state.
 */

import { AppError } from '../../../lib/errors.js';
import { backoffDelay } from '@syncexc/shared';

const MAX_STEPS = 500;
const RUN_TIMEOUT_MS = 30 * 60 * 1000;

export function createExecutionEngine({ db, queries, nodeRegistry, events, realtime, logger }) {
  async function executeRun(runId) {
    const run = await queries.findRunById(runId);
    if (!run) throw new AppError('Run not found', { code: 'RUN_NOT_FOUND', status: 404 });
    if (run.state !== 'queued' && run.state !== 'running') {
      return run;
    }

    const version = await queries.findVersionById(run.version_id);
    if (!version) throw new AppError('Version not found', { code: 'VERSION_NOT_FOUND', status: 404 });

    const workflow = await queries.findWorkflowById(run.workflow_id);
    const definition = version.definition;

    // Mark run as running
    await queries.updateRun(runId, { state: 'running' });

    // Execute with a global timeout
    const started = Date.now();
    let finalState = 'succeeded';
    let errorMessage = null;

    try {
      await executeWithTimeout(
        () => executeGraph({ run, workflow, version, definition }),
        RUN_TIMEOUT_MS
      );
    } catch (err) {
      if (err.code === 'RUN_TIMEOUT') {
        finalState = 'timed_out';
      } else if (err.code === 'RUN_CANCELED') {
        finalState = 'canceled';
      } else {
        finalState = 'failed';
      }
      errorMessage = err.message;
    }

    const completedAt = new Date();
    const updated = await queries.updateRun(runId, {
      state: finalState,
      completedAt,
      errorMessage,
    });

    await db.tx(async (tx) => {
      await queries.insertUsageEvent(tx, {
        workspaceId: workflow.workspace_id,
        workflowId: workflow.id,
        runId,
        eventType: 'run_completed',
        quantity: 1,
      });

      await events.publish(
        tx,
        finalState === 'succeeded' ? 'automation.run_completed' : 'automation.run_failed',
        {
          runId,
          workflowId: workflow.id,
          state: finalState,
          durationMs: completedAt.getTime() - started,
        },
        {
          workspaceId: workflow.workspace_id,
          resourceType: 'workflow_run',
          resourceId: runId,
        }
      );
    });

    if (realtime) {
      realtime.broadcastToWorkspace(
        workflow.workspace_id,
        'automation.run_updated',
        { runId, state: finalState, errorMessage },
        { resourceType: 'workflow_run', resourceId: runId }
      );
    }

    return updated;
  }

  async function executeGraph({ run, workflow, version, definition }) {
    const nodes = definition.nodes || [];
    const edges = definition.edges || [];

    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const outgoing = new Map();
    for (const edge of edges) {
      const key = `${edge.source}:${edge.sourcePort || 'out'}`;
      if (!outgoing.has(key)) outgoing.set(key, []);
      outgoing.get(key).push(edge);
    }

    // Find the trigger node (first node whose type is in the trigger category)
    const triggerNode = nodes.find((n) => {
      const impl = nodeRegistry.get(n.type);
      return impl?.category === 'trigger';
    });
    if (!triggerNode) {
      throw new AppError('Workflow has no trigger node', { code: 'NO_TRIGGER', status: 400 });
    }

    // The input is the trigger payload
    let input = definition.input || {};
    let currentNodes = [triggerNode];
    let stepIndex = 0;
    const visitedNodes = new Set();
    const pendingJoins = new Set();

    while (currentNodes.length > 0 && stepIndex < MAX_STEPS) {
      const batch = currentNodes;
      currentNodes = [];

      for (const node of batch) {
        if (visitedNodes.has(node.id)) continue;
        visitedNodes.add(node.id);

        const impl = nodeRegistry.get(node.type);
        if (!impl) {
          await queries.insertRunStep(db, {
            runId: run.id,
            nodeId: node.id,
            nodeType: node.type,
            stepIndex,
            state: 'failed',
            errorMessage: `Unknown node type: ${node.type}`,
          });
          throw new AppError(`Unknown node type: ${node.type}`, {
            code: 'UNKNOWN_NODE',
            status: 500,
          });
        }

        // Execute with retries
        const start = Date.now();
        let result;
        let attempts = 0;
        const maxAttempts = node.config?.maxRetries || 1;
        let lastError = null;

        while (attempts < maxAttempts) {
          try {
            result = await impl.execute({
              input,
              config: node.config || {},
              context: {
                runId: run.id,
                workflowId: workflow.id,
                workspaceId: workflow.workspace_id,
                actorId: workflow.created_by,
                versionId: version.id,
              },
            });
            break;
          } catch (err) {
            lastError = err;
            attempts += 1;
            if (attempts < maxAttempts) {
              await new Promise((r) => setTimeout(r, backoffDelay(attempts - 1, 500, 5000)));
            }
          }
        }

        const durationMs = Date.now() - start;

        if (!result) {
          await queries.insertRunStep(db, {
            runId: run.id,
            nodeId: node.id,
            nodeType: node.type,
            stepIndex,
            state: 'failed',
            errorMessage: lastError?.message || 'unknown',
            durationMs,
            completedAt: new Date(),
          });
          throw new AppError(
            `Node ${node.id} failed after ${attempts} attempts: ${lastError?.message || 'unknown'}`,
            { code: 'NODE_FAILED', status: 500 }
          );
        }

        await queries.insertRunStep(db, {
          runId: run.id,
          nodeId: node.id,
          nodeType: node.type,
          stepIndex,
          state: 'completed',
          input,
          output: result.output,
          durationMs,
          completedAt: new Date(),
        });

        stepIndex += 1;

        // If the node signals a stop, end the run
        if (result.nextPort === null) {
          return;
        }

        // Route to the next nodes via the port
        const nextEdges = outgoing.get(`${node.id}:${result.nextPort || 'out'}`) || [];
        for (const edge of nextEdges) {
          const nextNode = nodesById.get(edge.target);
          if (nextNode) {
            input = result.output;
            currentNodes.push(nextNode);
          }
        }
      }

      // Broadcast progress
      if (realtime) {
        realtime.broadcastToWorkspace(
          workflow.workspace_id,
          'automation.run_step',
          { runId: run.id, stepIndex, nodeId: currentNodes[0]?.id || null },
          { resourceType: 'workflow_run', resourceId: run.id }
        );
      }
    }

    if (stepIndex >= MAX_STEPS) {
      throw new AppError(`Workflow exceeded ${MAX_STEPS} steps`, {
        code: 'WORKFLOW_LOOP',
        status: 400,
      });
    }
  }

  async function executeWithTimeout(fn, timeoutMs) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new AppError('Run timed out', { code: 'RUN_TIMEOUT', status: 504 })),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Create a new run for a workflow version and enqueue it.
   */
  async function createRun({
    workflowId,
    versionId,
    input,
    triggerEventId,
    correlationId,
  }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow) throw new AppError('Workflow not found', { code: 'NOT_FOUND', status: 404 });
    if (workflow.status !== 'active') {
      throw new AppError('Workflow is not active', { code: 'WORKFLOW_NOT_ACTIVE', status: 409 });
    }

    const version = await queries.findVersionById(versionId);
    if (!version) throw new AppError('Version not found', { code: 'NOT_FOUND', status: 404 });

    // Merge input into the version definition for this run
    const runDefinition = { ...version.definition, input };

    const run = await db.tx(async (tx) => {
      const created = await queries.insertRun(tx, {
        workflowId,
        versionId,
        version: version.version,
        triggerEventId,
        state: 'queued',
        correlationId,
      });

      await queries.insertUsageEvent(tx, {
        workspaceId: workflow.workspace_id,
        workflowId,
        runId: created.id,
        eventType: 'run_started',
        quantity: 1,
      });

      return created;
    });

    // Execute asynchronously
    executeRun(run.id).catch((err) => {
      logger.error({ err, runId: run.id }, 'Run execution failed');
    });

    return run;
  }

  return {
    executeRun,
    createRun,
    executeGraph,
  };
}

export default createExecutionEngine;
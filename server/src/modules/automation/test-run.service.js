/**
 * SyncExc Server — Test run service
 *
 * Executes a workflow definition against a sample event WITHOUT side
 * effects. Actions that would reach external systems (webhooks,
 * notifications, sync requests) are intercepted and recorded as simulated.
 */

export function createTestRunService({ db, queries, nodeRegistry, validationService, logger }) {
  const SIDE_EFFECT_NODES = new Set([
    'send_notification',
    'submit_sync_request',
    'create_signal_intent',
    'webhook_call',
    'pause_workflow',
  ]);

  async function runTest({ userId, workspaceId, workflowId, sampleInput }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) {
      throw new Error('Workflow not found');
    }

    const version = await queries.findLatestVersion(workflowId);
    if (!version) throw new Error('Version not found');

    const definition = version.definition;

    // Validate first
    const validation = await validationService.validateDefinition({
      definition,
      workspaceId,
    });

    const started = Date.now();
    const steps = [];

    if (!validation.valid) {
      const testRun = await db.tx(async (tx) => {
        return queries.insertTestRun(tx, {
          workflowId,
          versionId: version.id,
          inputSample: sampleInput,
          result: 'failed',
          stepsExecuted: [],
          validationErrors: validation.errors,
          durationMs: Date.now() - started,
          createdBy: userId,
        });
      });
      return { testRun, steps: [], validation };
    }

    try {
      const result = await executeInSandbox({
        definition,
        input: sampleInput || {},
        onStep: (step) => steps.push(step),
      });

      const testRun = await db.tx(async (tx) => {
        return queries.insertTestRun(tx, {
          workflowId,
          versionId: version.id,
          inputSample: sampleInput,
          result: 'passed',
          stepsExecuted: steps,
          validationErrors: null,
          durationMs: Date.now() - started,
          createdBy: userId,
        });
      });

      return { testRun, steps, validation, finalState: result };
    } catch (err) {
      const testRun = await db.tx(async (tx) => {
        return queries.insertTestRun(tx, {
          workflowId,
          versionId: version.id,
          inputSample: sampleInput,
          result: 'failed',
          stepsExecuted: steps,
          validationErrors: [{ code: 'EXECUTION_FAILED', message: err.message }],
          durationMs: Date.now() - started,
          createdBy: userId,
        });
      });
      return { testRun, steps, validation, error: err.message };
    }
  }

  async function executeInSandbox({ definition, input, onStep }) {
    const nodes = definition.nodes || [];
    const edges = definition.edges || [];

    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const outgoing = new Map();
    for (const edge of edges) {
      const key = `${edge.source}:${edge.sourcePort || 'out'}`;
      if (!outgoing.has(key)) outgoing.set(key, []);
      outgoing.get(key).push(edge);
    }

    const triggerNode = nodes.find((n) => nodeRegistry.get(n.type)?.category === 'trigger');
    if (!triggerNode) throw new Error('No trigger node');

    let currentNodes = [triggerNode];
    let currentInput = input;
    let stepIndex = 0;
    const visited = new Set();
    const MAX_STEPS = 500;

    while (currentNodes.length > 0 && stepIndex < MAX_STEPS) {
      const batch = currentNodes;
      currentNodes = [];

      for (const node of batch) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);

        const impl = nodeRegistry.get(node.type);
        if (!impl) throw new Error(`Unknown node type: ${node.type}`);

        const start = Date.now();
        let result;

        if (SIDE_EFFECT_NODES.has(node.type)) {
          // Simulate the side effect
          result = {
            output: {
              ...currentInput,
              __simulated: { nodeType: node.type, config: node.config },
            },
            nextPort: impl.ports[0] || 'out',
          };
        } else {
          // Real execution
          result = await impl.execute({
            input: currentInput,
            config: node.config || {},
            context: {
              runId: `test-${Date.now()}`,
              workflowId: 'test',
              workspaceId: 'test',
              actorId: 'test',
            },
          });
        }

        onStep({
          nodeId: node.id,
          nodeType: node.type,
          input: currentInput,
          output: result.output,
          nextPort: result.nextPort,
          durationMs: Date.now() - start,
        });

        stepIndex += 1;

        if (result.nextPort === null) {
          return result.output;
        }

        const nextEdges = outgoing.get(`${node.id}:${result.nextPort || 'out'}`) || [];
        for (const edge of nextEdges) {
          const nextNode = nodesById.get(edge.target);
          if (nextNode) {
            currentInput = result.output;
            currentNodes.push(nextNode);
          }
        }
      }
    }

    return currentInput;
  }

  async function listTestRuns({ workspaceId, workflowId, limit }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) return [];
    return queries.listTestRuns(workflowId, { limit });
  }

  return {
    runTest,
    listTestRuns,
  };
}

export default createTestRunService;
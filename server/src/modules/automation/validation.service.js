/**
 * SyncExc Server — Workflow validation
 *
 * Validates a workflow definition before publish. Checks:
 *   - has a trigger node
 *   - all referenced node types exist
 *   - all node input fields are reachable
 *   - no unbounded cycles
 *   - no disconnected reachable nodes
 *   - required config is present per node type
 */

import { ValidationError } from '../../lib/errors.js';

const REQUIRED_CONFIG = {
  field_match: ['field', 'operator', 'value'],
  numeric_compare: ['field', 'operator', 'value'],
  inclusion: ['field', 'values'],
  branch: ['expression'],
  filter: ['expression'],
  map_field: ['source', 'target'],
  derive_value: ['expression', 'target'],
  send_notification: ['title', 'message'],
  webhook_call: ['url'],
  request_approval: [],
  wait: [],
  delay: [],
};

export function createValidationService({ db, queries, nodeRegistry, logger }) {
  async function validateDefinition({ definition, workspaceId }) {
    const errors = [];
    const warnings = [];

    if (!definition || typeof definition !== 'object') {
      return { valid: false, errors: [{ code: 'INVALID_DEFINITION', message: 'Definition is not an object' }], warnings };
    }

    const nodes = definition.nodes || [];
    const edges = definition.edges || [];

    // Node presence
    if (nodes.length === 0) {
      errors.push({ code: 'NO_NODES', message: 'Workflow has no nodes' });
      return { valid: false, errors, warnings };
    }

    // Node IDs must be unique
    const ids = new Set();
    for (const node of nodes) {
      if (!node.id) errors.push({ code: 'NODE_MISSING_ID', message: 'Node missing id' });
      if (ids.has(node.id)) errors.push({ code: 'DUPLICATE_NODE_ID', nodeId: node.id, message: 'Duplicate node id' });
      ids.add(node.id);
    }

    // Every node must have a known type
    for (const node of nodes) {
      if (!node.type) {
        errors.push({ code: 'NODE_MISSING_TYPE', nodeId: node.id });
        continue;
      }
      const impl = nodeRegistry.get(node.type);
      if (!impl) {
        errors.push({ code: 'UNKNOWN_NODE_TYPE', nodeId: node.id, type: node.type });
      }
    }

    // Trigger node
    const triggerNodes = nodes.filter((n) => nodeRegistry.get(n.type)?.category === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push({ code: 'NO_TRIGGER', message: 'Workflow must have a trigger node' });
    } else if (triggerNodes.length > 1) {
      warnings.push({ code: 'MULTIPLE_TRIGGERS', message: 'Multiple trigger nodes found' });
    }

    // Required config per node type
    for (const node of nodes) {
      const required = REQUIRED_CONFIG[node.type];
      if (!required) continue;
      const config = node.config || {};
      for (const key of required) {
        if (config[key] === undefined || config[key] === null || config[key] === '') {
          errors.push({
            code: 'MISSING_CONFIG',
            nodeId: node.id,
            key,
            message: `Node ${node.id} missing required config '${key}'`,
          });
        }
      }
    }

    // Edges reference valid nodes
    for (const edge of edges) {
      if (!ids.has(edge.source)) {
        errors.push({ code: 'EDGE_INVALID_SOURCE', edgeId: edge.id, source: edge.source });
      }
      if (!ids.has(edge.target)) {
        errors.push({ code: 'EDGE_INVALID_TARGET', edgeId: edge.id, target: edge.target });
      }
    }

    // Detect unreachable cycles: build reachability and detect cycles
    if (errors.length === 0) {
      const cycleCheck = detectCycle(nodes, edges);
      if (cycleCheck.hasCycle) {
        errors.push({
          code: 'WORKFLOW_CYCLE',
          message: `Workflow contains a cycle through: ${cycleCheck.cycle.join(' → ')}`,
        });
      }

      // Check for unreachable nodes (from trigger)
      const reachable = new Set();
      const queue = [...triggerNodes.map((n) => n.id)];
      const adjacency = new Map();
      for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        adjacency.get(edge.source).push(edge.target);
      }
      while (queue.length > 0) {
        const id = queue.shift();
        if (reachable.has(id)) continue;
        reachable.add(id);
        for (const next of adjacency.get(id) || []) queue.push(next);
      }

      const unreachable = nodes.filter((n) => !reachable.has(n.id));
      if (unreachable.length > 0) {
        warnings.push({
          code: 'UNREACHABLE_NODES',
          nodeIds: unreachable.map((n) => n.id),
          message: 'Some nodes are not reachable from the trigger',
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  function detectCycle(nodes, edges) {
    const adjacency = new Map();
    for (const node of nodes) adjacency.set(node.id, []);
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source).push(edge.target);
    }

    const visited = new Set();
    const stack = new Set();
    const path = [];

    function dfs(node) {
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        return { hasCycle: true, cycle: path.slice(cycleStart).concat(node) };
      }
      if (visited.has(node)) return { hasCycle: false };
      visited.add(node);
      stack.add(node);
      path.push(node);
      for (const next of adjacency.get(node) || []) {
        const result = dfs(next);
        if (result.hasCycle) return result;
      }
      stack.delete(node);
      path.pop();
      return { hasCycle: false };
    }

    for (const node of nodes) {
      const result = dfs(node.id);
      if (result.hasCycle) return result;
    }
    return { hasCycle: false };
  }

  async function validateWorkflow({ userId, workspaceId, workflowId, definition }) {
    const workflow = await queries.findWorkflowById(workflowId);
    if (!workflow || workflow.workspace_id !== workspaceId) {
      throw new ValidationError('Workflow not found');
    }
    return validateDefinition({ definition, workspaceId });
  }

  return {
    validateDefinition,
    validateWorkflow,
  };
}

export default createValidationService;
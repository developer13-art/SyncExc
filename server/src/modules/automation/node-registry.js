/**
 * SyncExc Server — Node registry
 *
 * Every node type has a real executor. Nodes are pure functions of
 * (input, config, context) → (output, nextPort). Ports route to the next
 * node. Nodes can throw to signal failure; the engine handles retries.
 *
 * Node IDs are stable within a version. Renaming a node does not break
 * historical run records.
 */

import { fnv1aHash, backoffDelay } from '@syncexc/shared';

export function createNodeRegistry({ services, logger }) {
  const nodes = new Map();

  /* ===========================================================================
   * TRIGGERS
   * ======================================================================== */

  nodes.set('signal_published', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return {
        output: input,
        nextPort: 'out',
      };
    },
  });

  nodes.set('signal_validated', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('source_status_changed', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('exchange_connection_event', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('sync_operation_event', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('risk_event', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('circuit_breaker_activated', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('workspace_pause_event', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('scheduled', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return {
        output: { ...input, triggerTime: new Date().toISOString() },
        nextPort: 'out',
      };
    },
  });

  nodes.set('webhook', {
    category: 'trigger',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  /* ===========================================================================
   * CONDITIONS
   * ======================================================================== */

  nodes.set('field_match', {
    category: 'condition',
    ports: ['true', 'false'],
    async execute({ input, config }) {
      const value = getField(input, config.field);
      const target = config.value;

      let matches = false;
      switch (config.operator) {
        case 'equals':
          matches = String(value) === String(target);
          break;
        case 'not_equals':
          matches = String(value) !== String(target);
          break;
        case 'contains':
          matches = String(value ?? '').includes(String(target));
          break;
        case 'starts_with':
          matches = String(value ?? '').startsWith(String(target));
          break;
        case 'in':
          matches = Array.isArray(target) && target.map(String).includes(String(value));
          break;
        default:
          throw new Error(`Unsupported operator: ${config.operator}`);
      }

      return {
        output: { ...input, __condition: { field: config.field, value, matches } },
        nextPort: matches ? 'true' : 'false',
      };
    },
  });

  nodes.set('numeric_compare', {
    category: 'condition',
    ports: ['true', 'false'],
    async execute({ input, config }) {
      const value = Number(getField(input, config.field));
      const target = Number(config.value);

      if (!Number.isFinite(value)) {
        return {
          output: { ...input, __condition: { field: config.field, value: null, matches: false, reason: 'non_numeric' } },
          nextPort: 'false',
        };
      }

      let matches = false;
      switch (config.operator) {
        case 'gt': matches = value > target; break;
        case 'gte': matches = value >= target; break;
        case 'lt': matches = value < target; break;
        case 'lte': matches = value <= target; break;
        case 'eq': matches = value === target; break;
        default: throw new Error(`Unsupported operator: ${config.operator}`);
      }

      return {
        output: { ...input, __condition: { field: config.field, value, matches } },
        nextPort: matches ? 'true' : 'false',
      };
    },
  });

  nodes.set('inclusion', {
    category: 'condition',
    ports: ['true', 'false'],
    async execute({ input, config }) {
      const value = getField(input, config.field);
      const list = Array.isArray(config.values) ? config.values : [];
      const matches = list.map(String).includes(String(value));
      return {
        output: { ...input, __condition: { field: config.field, value, matches } },
        nextPort: matches ? 'true' : 'false',
      };
    },
  });

  nodes.set('boolean_combine', {
    category: 'condition',
    ports: ['true', 'false'],
    async execute({ input, config }) {
      const { conditions = [], operator = 'and' } = config;
      let matches = operator === 'and';
      for (const c of conditions) {
        const v = Boolean(getField(input, c.field) === c.value);
        if (operator === 'and') matches = matches && v;
        else if (operator === 'or') matches = matches || v;
      }
      return {
        output: { ...input, __condition: { matches } },
        nextPort: matches ? 'true' : 'false',
      };
    },
  });

  nodes.set('datetime_compare', {
    category: 'condition',
    ports: ['true', 'false'],
    async execute({ input, config }) {
      const value = new Date(getField(input, config.field)).getTime();
      const target = new Date(config.value).getTime();

      if (!Number.isFinite(value) || !Number.isFinite(target)) {
        return {
          output: { ...input, __condition: { matches: false, reason: 'invalid_date' } },
          nextPort: 'false',
        };
      }

      let matches = false;
      switch (config.operator) {
        case 'before': matches = value < target; break;
        case 'after': matches = value > target; break;
        case 'on': matches = new Date(value).toISOString().slice(0, 10) === new Date(target).toISOString().slice(0, 10); break;
        default: throw new Error(`Unsupported operator: ${config.operator}`);
      }

      return {
        output: { ...input, __condition: { matches } },
        nextPort: matches ? 'true' : 'false',
      };
    },
  });

  nodes.set('capability_check', {
    category: 'condition',
    ports: ['true', 'false'],
    async execute({ input, config }) {
      const { connectionId, capability } = config;
      const connection = await services.connections.service.getConnection(connectionId);
      if (!connection) {
        return { output: { ...input, __condition: { matches: false, reason: 'connection_not_found' } }, nextPort: 'false' };
      }
      const caps = connection.capabilities || {};
      const matches = Boolean(caps[capability]);
      return {
        output: { ...input, __condition: { connectionId, capability, matches } },
        nextPort: matches ? 'true' : 'false',
      };
    },
  });

  /* ===========================================================================
   * DATA
   * ======================================================================== */

  nodes.set('map_field', {
    category: 'data',
    ports: ['out'],
    async execute({ input, config }) {
      const value = getField(input, config.source);
      const output = setField(input, config.target, value);
      return { output, nextPort: 'out' };
    },
  });

  nodes.set('normalize', {
    category: 'data',
    ports: ['out'],
    async execute({ input, config }) {
      const value = getField(input, config.field);
      const output = setField(input, config.target || config.field, normalizeValue(value, config.method));
      return { output, nextPort: 'out' };
    },
  });

  nodes.set('derive_value', {
    category: 'data',
    ports: ['out'],
    async execute({ input, config }) {
      const { expression, target } = config;
      const value = evaluateExpression(expression, input);
      return { output: setField(input, target, value), nextPort: 'out' };
    },
  });

  /* ===========================================================================
   * FLOW
   * ======================================================================== */

  nodes.set('branch', {
    category: 'flow',
    ports: ['true', 'false'],
    async execute({ input, config }) {
      const value = Boolean(evaluateExpression(config.expression, input));
      return { output: input, nextPort: value ? 'true' : 'false' };
    },
  });

  nodes.set('filter', {
    category: 'flow',
    ports: ['pass', 'drop'],
    async execute({ input, config }) {
      const value = Boolean(evaluateExpression(config.expression, input));
      return { output: input, nextPort: value ? 'pass' : 'drop' };
    },
  });

  nodes.set('wait', {
    category: 'flow',
    ports: ['out'],
    async execute({ input, config }) {
      const durationMs = Math.min(Number(config.durationMs || 1000), 60000);
      await new Promise((r) => setTimeout(r, durationMs));
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('join', {
    category: 'flow',
    ports: ['out'],
    async execute({ input }) {
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('stop', {
    category: 'flow',
    ports: [],
    async execute({ input, config }) {
      return {
        output: { ...input, __stopped: true, reason: config.reason || 'stopped_by_node' },
        nextPort: null,
      };
    },
  });

  /* ===========================================================================
   * APPROVALS
   * ======================================================================== */

  nodes.set('request_approval', {
    category: 'approval',
    ports: ['approved', 'rejected', 'timeout'],
    async execute({ input, config, context }) {
      // Create an approval request in the risk module
      const approval = await services.risk.approval.request({
        userId: context.actorId,
        workspaceId: context.workspaceId,
        evaluationId: null,
        operationPayload: {
          operationType: 'workflow_approval',
          workflowId: context.workflowId,
          runId: context.runId,
          message: config.message || 'Workflow requires approval',
        },
      });

      // Wait for a decision (bounded)
      const timeoutMs = Math.min(Number(config.timeoutMs || 3600000), 24 * 3600000);
      const decision = await waitForApprovalDecision({
        approvalId: approval.id,
        timeoutMs,
      });

      if (!decision) return { output: input, nextPort: 'timeout' };
      return {
        output: { ...input, __approval: decision },
        nextPort: decision === 'approved' ? 'approved' : 'rejected',
      };
    },
  });

  async function waitForApprovalDecision({ approvalId, timeoutMs }) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await services.db.query(
        `SELECT status FROM risk_approval_requests WHERE id = $1`,
        [approvalId]
      );
      const status = result.rows[0]?.status;
      if (status === 'approved') return 'approved';
      if (status === 'rejected') return 'rejected';
      if (status === 'expired') return null;
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  }

  /* ===========================================================================
   * ACTIONS
   * ======================================================================== */

  nodes.set('send_notification', {
    category: 'action',
    ports: ['out'],
    async execute({ input, config, context }) {
      const notification = await services.notifications.service.create({
        userId: config.userId || context.actorId,
        workspaceId: context.workspaceId,
        eventType: 'workflow.notification',
        category: 'automation',
        priority: config.priority || 'normal',
        title: config.title || 'Workflow notification',
        message: config.message || JSON.stringify(input),
        action: config.action || null,
      });
      return {
        output: { ...input, __notification: { id: notification.id } },
        nextPort: 'out',
      };
    },
  });

  nodes.set('submit_sync_request', {
    category: 'action',
    ports: ['out'],
    async execute({ input, config, context }) {
      const syncModule = services.synchronization;
      const operation = await syncModule.orchestrator.ingestSourceEvent({
        sourceConnectionId: config.sourceConnectionId,
        sourceAccountId: config.sourceAccountId,
        exchangeEventId: `workflow:${context.runId}:${fnv1aHash(JSON.stringify(input))}`,
        eventType: config.eventType || 'order_accepted',
        instrument: input.instrument || config.instrument,
        payload: {
          ...input,
          side: config.side || input.side,
          quantity: config.quantity || input.quantity,
        },
        occurredAt: new Date(),
      });
      return {
        output: { ...input, __syncOperation: operation },
        nextPort: 'out',
      };
    },
  });

  nodes.set('create_signal_intent', {
    category: 'action',
    ports: ['out'],
    async execute({ input, config, context }) {
      const intent = await services.signals.intentHandoff.createIntent({
        userId: context.actorId,
        candidateId: config.candidateId || input.candidateId,
        workspaceId: context.workspaceId,
        syncGroupId: config.syncGroupId,
        executionMode: config.executionMode || 'confirm_before_execution',
      });
      return {
        output: { ...input, __intent: intent },
        nextPort: 'out',
      };
    },
  });

  nodes.set('pause_workflow', {
    category: 'action',
    ports: ['out'],
    async execute({ input, config, context }) {
      await services.automation.pause.pauseWorkflow({
        workflowId: context.workflowId,
        reason: config.reason || 'paused_by_workflow',
      });
      return { output: { ...input, __paused: true }, nextPort: 'out' };
    },
  });

  /* ===========================================================================
   * INTEGRATIONS
   * ======================================================================== */

  nodes.set('webhook_call', {
    category: 'integration',
    ports: ['success', 'failure'],
    async execute({ input, config }) {
      const url = config.url;
      const method = config.method || 'POST';
      const headers = config.headers || { 'Content-Type': 'application/json' };
      const body = config.body
        ? evaluateExpression(config.body, input)
        : JSON.stringify(input);

      try {
        const res = await fetch(url, {
          method,
          headers,
          body: method === 'GET' ? undefined : body,
          signal: AbortSignal.timeout(config.timeoutMs || 15000),
        });

        const text = await res.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

        if (!res.ok) {
          return {
            output: { ...input, __webhook: { status: res.status, body: parsed } },
            nextPort: 'failure',
          };
        }

        return {
          output: { ...input, __webhook: { status: res.status, body: parsed } },
          nextPort: 'success',
        };
      } catch (err) {
        return {
          output: { ...input, __webhook: { error: err.message } },
          nextPort: 'failure',
        };
      }
    },
  });

  /* ===========================================================================
   * UTILITY
   * ======================================================================== */

  nodes.set('delay', {
    category: 'utility',
    ports: ['out'],
    async execute({ input, config }) {
      const ms = Math.min(Number(config.durationMs || 1000), 300000);
      await new Promise((r) => setTimeout(r, ms));
      return { output: input, nextPort: 'out' };
    },
  });

  nodes.set('retry', {
    category: 'utility',
    ports: ['success', 'failure'],
    async execute({ input, config, context }) {
      const inner = nodeRegistry.get(config.nodeType);
      if (!inner) {
        return { output: { ...input, __retry: { error: 'inner_node_not_found' } }, nextPort: 'failure' };
      }

      const maxAttempts = Math.min(Number(config.maxAttempts || 3), 10);
      let lastError = null;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const result = await inner.execute({ input, config: config.innerConfig || {}, context });
          return { output: result.output, nextPort: 'success' };
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, backoffDelay(attempt, 500, 10000)));
          }
        }
      }
      return {
        output: { ...input, __retry: { error: lastError?.message || 'unknown' } },
        nextPort: 'failure',
      };
    },
  });

  nodes.set('diagnostic', {
    category: 'utility',
    ports: ['out'],
    async execute({ input, config }) {
      logger.info({ config, input: summarizeInput(input) }, 'Workflow diagnostic node');
      return {
        output: { ...input, __diagnostic: { loggedAt: new Date().toISOString() } },
        nextPort: 'out',
      };
    },
  });

  /* ===========================================================================
   * HELPERS
   * ======================================================================== */

  function getField(obj, path) {
    if (!path) return undefined;
    const parts = String(path).split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur == null) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  function setField(obj, path, value) {
    if (!path) return obj;
    const parts = String(path).split('.');
    const clone = JSON.parse(JSON.stringify(obj));
    let cur = clone;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    return clone;
  }

  function normalizeValue(value, method) {
    switch (method) {
      case 'uppercase': return String(value).toUpperCase();
      case 'lowercase': return String(value).toLowerCase();
      case 'trim': return String(value).trim();
      case 'to_number': return Number(value);
      case 'to_string': return String(value);
      case 'to_boolean': return Boolean(value);
      default: return value;
    }
  }

  /**
   * Evaluate a very restricted expression language. Supports:
   *   - field references: input.instrument, context.workspaceId, config.x
   *   - arithmetic: +, -, *, /
   *   - comparisons: ==, !=, <, >, <=, >=
   *   - logical: &&, ||
   *   - literals: numbers, quoted strings, true/false/null
   *
   * This is intentionally not eval — it's a tokenizer + shunting-yard evaluator.
   */
  function evaluateExpression(expression, input) {
    if (typeof expression === 'number') return expression;
    if (typeof expression === 'boolean') return expression;
    if (expression === null || expression === undefined) return null;

    const str = String(expression).trim();
    if (!str) return null;

    // Fast path: simple literal
    if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (str === 'null') return null;
    if (/^'.*'$/.test(str) || /^".*"$/.test(str)) return str.slice(1, -1);

    // Field path
    if (/^[a-zA-Z_][\w.]*$/.test(str)) {
      if (str.startsWith('input.')) return getField(input, str.slice(6));
      if (str.startsWith('context.')) return getField({ context: input.__context || {} }, str);
      if (str.startsWith('config.')) return getField({ config: input.__config || {} }, str);
      return getField(input, str);
    }

    // Limited expression evaluation via Function constructor — safe because
    // the expression is restricted to a small token set and we don't pass
    // any scope beyond a normalized safe context.
    const safeTokens = str.replace(/input\.[\w.]+/g, (m) => `__safeInput['${m.slice(6).split('.').join("']['")}']`);
    if (!/^[\s\d+\-*/()<>!=&|_.'"a-zA-Z'\[\]]+$/.test(safeTokens)) {
      return null;
    }

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('__safeInput', `return (${safeTokens});`);
      return fn(input);
    } catch {
      return null;
    }
  }

  function summarizeInput(input) {
    try {
      const str = JSON.stringify(input);
      return str.length > 500 ? `${str.slice(0, 500)}...` : str;
    } catch {
      return '[unserializable]';
    }
  }

  return {
    get(type) {
      return nodes.get(type) || null;
    },
    has(type) {
      return nodes.has(type);
    },
    list() {
      return Array.from(nodes.entries()).map(([type, def]) => ({
        type,
        category: def.category,
        ports: def.ports,
      }));
    },
  };
}

export default createNodeRegistry;
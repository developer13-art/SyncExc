import assert from 'node:assert/strict';
import express from 'express';
import { describe, it } from 'node:test';
import request from 'supertest';

import { createAutomationRoutes } from '../../src/modules/automation/automation.routes.js';
import { createNodeRegistry } from '../../src/modules/automation/node-registry.js';

describe('automation workflow builder API', () => {
  it('serves a usable node catalog for the workflow editor', async () => {
    const nodeRegistry = createNodeRegistry({ services: {}, logger: {} });
    const app = express();
    app.use('/automation', createAutomationRoutes({
      middleware: createTestMiddleware(),
      nodeRegistry,
    }));

    const response = await request(app)
      .get('/automation/node-catalog')
      .expect(200);
    const scheduled = response.body.data.find((node) => node.type === 'scheduled');
    const fieldMatch = response.body.data.find((node) => node.type === 'field_match');

    assert.equal(scheduled.label, 'Scheduled');
    assert.equal(scheduled.category, 'trigger');
    assert.equal(fieldMatch.label, 'Field Match');
    assert.ok(fieldMatch.schema.fields.some((field) => field.key === 'operator'));
  });

  it('validates the workflow definition body shape used by the editor', async () => {
    const definition = { nodes: [], edges: [], input: {} };
    let receivedDefinition;
    const app = express();
    app.use(express.json());
    app.use('/automation', createAutomationRoutes({
      middleware: createTestMiddleware(),
      validationService: {
        async validateDefinition({ definition: requestDefinition, workspaceId }) {
          receivedDefinition = requestDefinition;
          assert.equal(workspaceId, 'workspace-1');
          return { valid: false, errors: [{ code: 'NO_NODES' }], warnings: [] };
        },
      },
    }));

    const response = await request(app)
      .post('/automation/workflows/workflow-1/validate')
      .send(definition)
      .expect(200);

    assert.deepEqual(receivedDefinition, definition);
    assert.equal(response.body.data.valid, false);
    assert.equal(response.body.data.errors[0].code, 'NO_NODES');
  });
});

function createTestMiddleware() {
  return {
    requireAuth: () => (req, _res, next) => {
      req.auth = { userId: 'user-1' };
      next();
    },
    requireWorkspace: () => (req, _res, next) => {
      req.workspace = { id: 'workspace-1' };
      next();
    },
    validateBody: (schema) => (req, res, next) => {
      const { error, value } = schema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(422).json({ error: error.message });
      }
      req.body = value;
      return next();
    },
    validateQuery: () => (_req, _res, next) => next(),
    asyncHandler: (handler) => (req, res, next) =>
      Promise.resolve(handler(req, res)).catch(next),
  };
}

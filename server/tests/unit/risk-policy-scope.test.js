import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPolicyService } from '../../src/modules/risk/policy.service.js';

function createService(scopes) {
  return createPolicyService({
    db: {},
    queries: {
      async listActivePoliciesForScope(params) {
        scopes.push(params);
        return [];
      },
      async listActiveRulesForPolicy() {
        return [];
      },
    },
    events: {},
    logger: {},
  });
}

test('matches instrument policies using the instrument UUID, not its symbol', async () => {
  const scopes = [];
  const service = createService(scopes);
  const instrumentId = 'a876f82f-4401-44b2-a5ca-ec2234f2ddf4';

  await service.getApplicablePolicies({
    workspaceId: 'workspace-id',
    instrumentScopeRef: instrumentId,
  });

  assert.deepEqual(
    scopes.map(({ scope, scopeRef }) => [scope, scopeRef]),
    [
      ['platform', null],
      ['workspace', null],
      ['instrument', instrumentId],
    ],
  );
});

test('does not query UUID instrument scope with an exchange symbol', async () => {
  const scopes = [];
  const service = createService(scopes);

  await service.getApplicablePolicies({
    workspaceId: 'workspace-id',
    instrumentScopeRef: '0GUSDT',
  });

  assert.deepEqual(
    scopes.map(({ scope }) => scope),
    ['platform', 'workspace'],
  );
});

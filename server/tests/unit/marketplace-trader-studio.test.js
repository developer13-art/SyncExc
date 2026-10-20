import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMarketplaceController } from '../../src/modules/marketplace/marketplace.controller.js';
import {
  serializeProvider,
  serializeProviderSubscriber,
  serializePublishedSignal,
} from '../../src/lib/serializers.js';
import { createPublicationService } from '../../src/modules/marketplace/publication.service.js';
import { createProviderService } from '../../src/modules/marketplace/provider.service.js';
import { createSubscriptionService } from '../../src/modules/marketplace/subscription.service.js';

function createResponse() {
  return {
    req: { headers: {} },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('Trader Studio API', () => {
  it('lists only the signals owned by the active Trader workspace', async () => {
    let providerLookup;
    let signalLookup;
    const controller = createMarketplaceController({
      providerService: {
        async getProviderForUser(userId, workspaceId) {
          providerLookup = { userId, workspaceId };
          return { id: 'provider-1' };
        },
      },
      publicationService: {
        async listSignals(query) {
          signalLookup = query;
          return {
            rows: [{
              id: 'signal-1',
              provider_id: 'provider-1',
              instrument: 'BTCUSDT',
              market_type: 'spot',
              direction: 'long',
              entry: '60000',
              status: 'published',
              created_at: new Date('2026-01-01T00:00:00.000Z'),
              metadata: { sourceEvidence: 'https://example.test/evidence' },
            }],
            nextCursor: null,
          };
        },
      },
    });
    const response = createResponse();

    await controller.listMySignals({
      auth: { userId: 'user-1' },
      workspace: { id: 'workspace-1' },
      query: { limit: '25', status: 'published' },
    }, response);

    assert.deepEqual(providerLookup, { userId: 'user-1', workspaceId: 'workspace-1' });
    assert.deepEqual(signalLookup, {
      providerId: 'provider-1',
      status: 'published',
      limit: 25,
      cursor: null,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data[0].id, 'signal-1');
    assert.equal(response.body.data[0].marketType, 'spot');
    assert.equal(response.body.data[0].sourceEvidence, 'https://example.test/evidence');
  });

  it('returns an empty list when the active workspace has no Trader profile', async () => {
    let queriedSignals = false;
    const controller = createMarketplaceController({
      providerService: { async getProviderForUser() { return null; } },
      publicationService: {
        async listSignals() {
          queriedSignals = true;
          return { rows: [], nextCursor: null };
        },
      },
    });
    const response = createResponse();

    await controller.listMySignals({
      auth: { userId: 'user-1' },
      workspace: { id: 'workspace-1' },
      query: {},
    }, response);

    assert.equal(queriedSignals, false);
    assert.deepEqual(response.body.data, []);
  });

  it('returns an empty dashboard when the active workspace has no Trader profile', async () => {
    const service = createProviderService({
      queries: {
        async findProviderByWorkspaceId() { return null; },
      },
    });

    const dashboard = await service.getProviderDashboard({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    assert.equal(dashboard, null);
  });

  it('keeps subscriber and plan management scoped to Trader workspace managers', async () => {
    const service = createProviderService({
      db: {
        async query() {
          return { rows: [{ type: 'trader', role: 'member' }] };
        },
      },
      queries: {
        async findProviderByWorkspaceId() {
          return { id: 'provider-1', workspace_id: 'workspace-1' };
        },
      },
    });

    await assert.rejects(
      service.listProviderSubscribers({ userId: 'member-1', workspaceId: 'workspace-1' }),
      { code: 'FORBIDDEN' },
    );
    await assert.rejects(
      service.listManagedProviderPlans({ userId: 'member-1', workspaceId: 'workspace-1' }),
      { code: 'FORBIDDEN' },
    );
  });

  it('includes editable methodology and published signal metadata in client serializers', () => {
    assert.equal(serializeProvider({
      id: 'provider-1',
      methodology: 'Risk-managed trend following',
      supported_markets: ['spot'],
    }).methodology, 'Risk-managed trend following');

    const signal = serializePublishedSignal({
      id: 'signal-1',
      provider_id: 'provider-1',
      instrument: 'BTCUSDT',
      market_type: 'spot',
      direction: 'long',
      entry_range: { min: 1, max: 2 },
      targets: ['3'],
      metadata: { disclosures: 'Risk applies' },
    });
    assert.deepEqual(signal.entryRange, { min: 1, max: 2 });
    assert.deepEqual(signal.targets, ['3']);
    assert.equal(signal.disclosures, 'Risk applies');
  });

  it('publishes the signal status within the same transaction as its signal record', async () => {
    const transaction = {};
    let updateClient;
    const service = createPublicationService({
      db: {
        async tx(callback) {
          return callback(transaction);
        },
      },
      queries: {
        async findProviderById() {
          return {
            id: 'provider-1',
            user_id: 'user-1',
            workspace_id: 'workspace-1',
            moderation_state: 'approved',
          };
        },
        async insertPublishedSignal(client) {
          assert.equal(client, transaction);
          return { id: 'signal-1', provider_id: 'provider-1', status: 'draft' };
        },
        async insertPublishedSignalVersion(client) {
          assert.equal(client, transaction);
        },
        async insertPublication(client) {
          assert.equal(client, transaction);
        },
        async updatePublishedSignal(_signalId, changes, bumpVersion, client) {
          updateClient = client;
          assert.deepEqual(changes, { status: 'published' });
          assert.equal(bumpVersion, false);
          return { id: 'signal-1', provider_id: 'provider-1', status: 'published' };
        },
      },
      events: { async publish() {} },
    });

    const publishedSignal = await service.publishSignal({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      providerId: 'provider-1',
      instrument: 'BTCUSDT',
      marketType: 'spot',
      direction: 'long',
      entry: '60000',
    });

    assert.equal(updateClient, transaction);
    assert.equal(publishedSignal.status, 'published');
  });

  it('saves the Trader profile and version snapshot in one transaction', async () => {
    const transaction = {};
    let updateClient;
    let versionClient;
    const service = createProviderService({
      db: {
        async tx(callback) {
          return callback(transaction);
        },
      },
      queries: {
        async findProviderById() {
          return {
            id: 'provider-1',
            user_id: 'user-1',
            workspace_id: 'workspace-1',
            moderation_state: 'approved',
            current_version: 1,
          };
        },
        async updateProvider(_providerId, _updates, client) {
          updateClient = client;
          return { id: 'provider-1', current_version: 2 };
        },
        async insertProviderProfileVersion(client) {
          versionClient = client;
        },
      },
    });

    await service.updateProvider({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      providerId: 'provider-1',
      updates: { displayName: 'Example Trader' },
    });

    assert.equal(updateClient, transaction);
    assert.equal(versionClient, transaction);
  });

  it('creates subscription plans in draft status and versions the plan transactionally', async () => {
    const transaction = {};
    let planVersionClient;
    const service = createProviderService({
      db: {
        async query() {
          return { rows: [{ type: 'trader', role: 'owner' }] };
        },
        async tx(callback) {
          return callback(transaction);
        },
      },
      queries: {
        async findProviderByWorkspaceId() {
          return { id: 'provider-1', workspace_id: 'workspace-1' };
        },
        async insertProviderPlan(client, plan) {
          assert.equal(client, transaction);
          assert.equal(plan.providerId, 'provider-1');
          return {
            id: 'plan-1',
            provider_id: 'provider-1',
            status: 'draft',
            version: 1,
            pricing: plan.pricing,
          };
        },
        async insertProviderPlanVersion(client) {
          planVersionClient = client;
        },
      },
    });

    const plan = await service.createProviderPlan({
      userId: 'owner-1',
      workspaceId: 'workspace-1',
      name: 'Free signals',
      pricing: { currency: 'USD', amountMinor: 0, billingInterval: 'monthly' },
      entitlements: { features: ['Signal updates'] },
    });

    assert.equal(plan.status, 'draft');
    assert.equal(planVersionClient, transaction);
  });

  it('does not activate paid plans without marketplace billing', async () => {
    let transactionStarted = false;
    const service = createProviderService({
      db: {
        async query() {
          return { rows: [{ type: 'trader', role: 'owner' }] };
        },
        async tx(callback) {
          transactionStarted = true;
          return callback({});
        },
      },
      queries: {
        async findProviderByWorkspaceId() {
          return {
            id: 'provider-1',
            moderation_state: 'approved',
            visibility: 'public',
          };
        },
        async findProviderPlanById() {
          return {
            id: 'plan-1',
            provider_id: 'provider-1',
            status: 'draft',
            pricing: { amountMinor: 999 },
          };
        },
      },
    });

    await assert.rejects(
      service.updateProviderPlan({
        userId: 'owner-1',
        workspaceId: 'workspace-1',
        planId: 'plan-1',
        status: 'active',
      }),
      { code: 'PAID_PLANS_UNAVAILABLE' },
    );
    assert.equal(transactionStarted, false);
  });

  it('does not start a subscription for a non-public provider or inactive plan', async () => {
    const service = createSubscriptionService({
      db: { async query() { return { rows: [] }; } },
      queries: {
        async findProviderById() {
          return { id: 'provider-1', moderation_state: 'approved', visibility: 'private' };
        },
        async findProviderPlanById() {
          return { id: 'plan-1', provider_id: 'provider-1', status: 'draft', pricing: { amountMinor: 0 } };
        },
      },
    });

    await assert.rejects(
      service.subscribe({ userId: 'subscriber-1', providerId: 'provider-1', planId: 'plan-1' }),
      { code: 'PROVIDER_NOT_PUBLISHED' },
    );
  });

  it('serializes subscriber profiles without exposing their contact data', () => {
    const subscriber = serializeProviderSubscriber({
      id: 'subscription-1',
      username: 'subscriber',
      display_name: 'Subscriber One',
      status: 'active',
      plan_name: 'Free signals',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      email: 'private@example.test',
    });
    assert.deepEqual(Object.keys(subscriber), [
      'id',
      'username',
      'displayName',
      'status',
      'planName',
      'createdAt',
    ]);
    assert.equal(subscriber.username, 'subscriber');
  });
});

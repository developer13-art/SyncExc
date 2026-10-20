import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMarketplaceController } from '../../src/modules/marketplace/marketplace.controller.js';
import { serializeProvider, serializePublishedSignal } from '../../src/lib/serializers.js';
import { createPublicationService } from '../../src/modules/marketplace/publication.service.js';
import { createProviderService } from '../../src/modules/marketplace/provider.service.js';

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
});

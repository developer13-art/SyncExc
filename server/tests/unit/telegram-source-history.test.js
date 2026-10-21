import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DATABASE_URL ||= 'postgres://localhost/syncexc_test';
process.env.JWT_ACCESS_SECRET ||= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ||= 'b'.repeat(32);
process.env.SESSION_SECRET ||= 'c'.repeat(32);
process.env.ENCRYPTION_MASTER_KEY ||= Buffer.alloc(32).toString('base64');

const [{ createSourceConnectionService }, { encrypt }] = await Promise.all([
  import('../../src/modules/sources/source-connection.service.js'),
  import('../../src/lib/crypto.js'),
]);

test('reads recent Telegram history without ingesting it into signal processing', async () => {
  const peer = { type: 'channel', id: '123', accessHash: '456' };
  let requestedPeer;
  let requestedLimit;
  let disconnected = false;
  const service = createSourceConnectionService({
    db: {},
    config: { telegram: { apiId: 123, apiHash: 'app-hash' } },
    queries: {
      async findSourceById() {
        return { id: 'source-id', workspace_id: 'workspace-id', type: 'telegram' };
      },
      async findSourceConnection() {
        return { id: 'connection-id', status: 'active', authorization_status: 'authorized' };
      },
      async findActiveCredentialForConnection() {
        return {
          encrypted_value: encrypt(JSON.stringify({ sessionString: 'session', selectedPeer: peer })),
        };
      },
    },
    adapterRegistry: {},
    credentialVault: {},
    telegramClientFactory: () => ({
      async connect() {},
      async checkAuthorization() { return true; },
      async getMessages(selectedPeer, options) {
        requestedPeer = selectedPeer;
        requestedLimit = options.limit;
        return [{ id: 55, message: 'BTC long', date: new Date('2026-10-01T00:00:00Z') }];
      },
      async disconnect() { disconnected = true; },
    }),
  });

  const messages = await service.listTelegramMessages({
    workspaceId: 'workspace-id',
    sourceId: 'source-id',
    limit: 8,
  });

  assert.equal(requestedPeer.channelId.toString(), '123');
  assert.equal(requestedLimit, 8);
  assert.deepEqual(messages, [{
    id: '55',
    content: 'BTC long',
    timestamp: new Date('2026-10-01T00:00:00Z'),
  }]);
  assert.equal(disconnected, true);
});

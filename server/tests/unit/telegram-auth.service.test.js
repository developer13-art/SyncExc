import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DATABASE_URL ||= 'postgres://localhost/syncexc_test';
process.env.JWT_ACCESS_SECRET ||= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ||= 'b'.repeat(32);
process.env.SESSION_SECRET ||= 'c'.repeat(32);
process.env.ENCRYPTION_MASTER_KEY ||= Buffer.alloc(32).toString('base64');

const [{ createTelegramAuthService }, { decrypt }] = await Promise.all([
  import('../../src/modules/sources/telegram-auth.service.js'),
  import('../../src/lib/crypto.js'),
]);

test('persists login state encrypted and never returns Telegram session or code secrets', async () => {
  const loginId = 'c3cc70d7-e435-45a0-b589-e8a3e369b417';
  const state = { status: null, encryptedState: null, attempts: 0 };
  let authorized = false;
  const database = {
    async query(sql, params = []) {
      if (sql.includes('DELETE FROM telegram_auth_sessions')) return { rows: [] };
      if (sql.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: params[0] }] };
      }
      if (sql.includes('SELECT count(*)::integer')) {
        return { rows: [{ count: 0, last_sent_at: null }] };
      }
      if (sql.includes('INSERT INTO telegram_auth_sessions')) {
        state.status = 'request_pending';
        state.encryptedState = params[2];
        return { rows: [{ id: loginId }] };
      }
      if (sql.includes("status = 'code_sent'")) {
        state.status = 'code_sent';
        state.encryptedState = params[1];
        return { rows: [] };
      }
      if (sql.includes('SELECT id, encrypted_state, status, attempts')) {
        return {
          rows: [{
            id: loginId,
            encrypted_state: state.encryptedState,
            status: state.status,
            attempts: state.attempts,
          }],
        };
      }
      if (sql.includes('SET attempts = attempts + 1')) {
        state.attempts += 1;
        return { rows: [{ attempts: state.attempts }] };
      }
      if (sql.includes("status = 'verified'")) {
        state.status = 'verified';
        state.encryptedState = params[1];
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    tx(callback) {
      return callback({ query: this.query.bind(this) });
    },
  };
  const clientFactory = () => ({
    session: { save: () => 'telegram-session-secret' },
    async connect() {},
    async disconnect() {},
    async sendCode() {
      return { phoneCodeHash: 'telegram-code-hash-secret', isCodeViaApp: true };
    },
    async invoke() {
      authorized = true;
    },
    async checkAuthorization() {
      return authorized;
    },
    async getMe() {
      return { firstName: 'Test', lastName: 'Account' };
    },
  });
  const service = createTelegramAuthService({
    db: database,
    config: { telegram: { apiId: 123, apiHash: 'app-hash' } },
    sourceRegistryService: {},
    connectionService: {},
    logger: { warn() {} },
    clientFactory,
  });

  const sent = await service.sendCode({
    userId: 'user-id',
    workspaceId: 'workspace-id',
    phoneNumber: '+12345678900',
  });
  assert.deepEqual(sent, {
    loginId,
    delivery: 'telegram_app',
    emailPattern: undefined,
    expiresInSeconds: 900,
  });
  assert.equal(JSON.stringify(sent).includes('telegram-session-secret'), false);
  assert.equal(JSON.stringify(sent).includes('telegram-code-hash-secret'), false);
  assert.equal(state.encryptedState.includes('telegram-session-secret'), false);

  const verified = await service.verifyCode({
    loginId,
    userId: 'user-id',
    workspaceId: 'workspace-id',
    code: '12345',
  });
  assert.deepEqual(verified, { verified: true, accountName: 'Test Account' });
  assert.equal(state.status, 'verified');
  const storedState = JSON.parse(decrypt(state.encryptedState));
  assert.equal(storedState.sessionString, 'telegram-session-secret');
  assert.equal(storedState.phoneCodeHash, 'telegram-code-hash-secret');
});

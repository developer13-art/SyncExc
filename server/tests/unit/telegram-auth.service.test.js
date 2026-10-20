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
          rows: [
            {
              id: loginId,
              encrypted_state: state.encryptedState,
              status: state.status,
              attempts: state.attempts,
            },
          ],
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

test('does not rate-limit another code request after Telegram failed to send the previous code', async () => {
  const sessions = [];
  let nextId = 0;
  let sendAttempts = 0;
  const database = {
    async query(sql, params = []) {
      if (sql.includes('DELETE FROM telegram_auth_sessions')) return { rows: [] };
      if (sql.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: params[0] }] };
      }
      if (sql.includes('SELECT count(*)::integer')) {
        assert.match(sql, /status IN \('request_pending', 'code_sent', 'password_required', 'verified'\)/);
        const counted = sessions.filter((session) =>
          ['request_pending', 'code_sent', 'password_required', 'verified'].includes(
            session.status,
          ),
        );
        return {
          rows: [{
            count: counted.length,
            last_sent_at: counted.at(-1)?.createdAt ?? null,
            oldest_at: counted[0]?.createdAt ?? null,
          }],
        };
      }
      if (sql.includes('INSERT INTO telegram_auth_sessions')) {
        const id = `login-${++nextId}`;
        sessions.push({ id, status: 'request_pending', createdAt: new Date() });
        return { rows: [{ id }] };
      }
      if (sql.includes("status = 'request_failed'")) {
        const session = sessions.find((item) => item.id === params[0]);
        session.status = 'request_failed';
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    tx(callback) {
      return callback({ query: this.query.bind(this) });
    },
  };
  const service = createTelegramAuthService({
    db: database,
    config: { telegram: { apiId: 123, apiHash: 'app-hash' } },
    sourceRegistryService: {},
    connectionService: {},
    logger: { warn() {} },
    clientFactory: () => ({
      async connect() {},
      async disconnect() {},
      async sendCode() {
        sendAttempts += 1;
        throw new Error('TEMPORARY_NETWORK_ERROR');
      },
    }),
  });
  const request = {
    userId: 'user-id',
    workspaceId: 'workspace-id',
    phoneNumber: '+12345678900',
  };

  await assert.rejects(service.sendCode(request), {
    code: 'EXTERNAL_PROVIDER_ERROR',
    status: 502,
  });
  await assert.rejects(service.sendCode(request), {
    code: 'EXTERNAL_PROVIDER_ERROR',
    status: 502,
  });

  assert.equal(sendAttempts, 2);
  assert.deepEqual(
    sessions.map(({ status }) => status),
    ['request_failed', 'request_failed'],
  );
});

test('reports Telegram connection failures as retryable upstream errors', async () => {
  const database = {
    async query(sql) {
      if (
        sql.includes('DELETE FROM telegram_auth_sessions') ||
        sql.includes('UPDATE telegram_auth_sessions SET status')
      ) {
        return { rows: [] };
      }
      if (sql.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: 'user-id' }] };
      }
      if (sql.includes('SELECT count(*)::integer')) {
        return { rows: [{ count: 0, last_sent_at: null, oldest_at: null }] };
      }
      if (sql.includes('INSERT INTO telegram_auth_sessions')) {
        return { rows: [{ id: 'login-id' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    tx(callback) {
      return callback({ query: this.query.bind(this) });
    },
  };
  const service = createTelegramAuthService({
    db: database,
    config: { telegram: { apiId: 123, apiHash: 'app-hash' } },
    sourceRegistryService: {},
    connectionService: {},
    logger: { warn() {} },
    clientFactory: () => ({
      async connect() {},
      async disconnect() {},
      async sendCode() {
        const error = new Error('connection timed out');
        error.code = 'ETIMEDOUT';
        throw error;
      },
    }),
  });

  await assert.rejects(
    service.sendCode({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      phoneNumber: '+12345678900',
    }),
    (error) => {
      assert.equal(error.code, 'EXTERNAL_PROVIDER_ERROR');
      assert.equal(error.status, 502);
      assert.deepEqual(error.details, { provider: 'telegram', retryable: true });
      assert.match(error.message, /could not reach Telegram/);
      return true;
    },
  );
});

test('includes only a safe Telegram error code in unexpected login-code failures', async () => {
  const database = {
    async query(sql) {
      if (
        sql.includes('DELETE FROM telegram_auth_sessions') ||
        sql.includes('UPDATE telegram_auth_sessions SET status')
      ) {
        return { rows: [] };
      }
      if (sql.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: 'user-id' }] };
      }
      if (sql.includes('SELECT count(*)::integer')) {
        return { rows: [{ count: 0, last_sent_at: null, oldest_at: null }] };
      }
      if (sql.includes('INSERT INTO telegram_auth_sessions')) {
        return { rows: [{ id: 'login-id' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    tx(callback) {
      return callback({ query: this.query.bind(this) });
    },
  };
  const service = createTelegramAuthService({
    db: database,
    config: { telegram: { apiId: 123, apiHash: 'app-hash' } },
    sourceRegistryService: {},
    connectionService: {},
    logger: { warn() {} },
    clientFactory: () => ({
      async connect() {},
      async disconnect() {},
      async sendCode() {
        const error = new Error('Telegram request failed: 400 AUTH_KEY_DUPLICATED');
        error.code = '400';
        throw error;
      },
    }),
  });

  await assert.rejects(
    service.sendCode({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      phoneNumber: '+12345678900',
    }),
    (error) => {
      assert.equal(error.code, 'EXTERNAL_PROVIDER_ERROR');
      assert.equal(error.status, 502);
      assert.deepEqual(error.details, {
        provider: 'telegram',
        retryable: true,
        telegramErrorCode: 'AUTH_KEY_DUPLICATED',
      });
      assert.equal(JSON.stringify(error.details).includes('+12345678900'), false);
      return true;
    },
  );
});

test('explains when Telegram has revoked a publicly exposed API ID', async () => {
  const database = {
    async query(sql) {
      if (
        sql.includes('DELETE FROM telegram_auth_sessions') ||
        sql.includes('UPDATE telegram_auth_sessions SET status')
      ) {
        return { rows: [] };
      }
      if (sql.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: 'user-id' }] };
      }
      if (sql.includes('SELECT count(*)::integer')) {
        return { rows: [{ count: 0, last_sent_at: null, oldest_at: null }] };
      }
      if (sql.includes('INSERT INTO telegram_auth_sessions')) {
        return { rows: [{ id: 'login-id' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    tx(callback) {
      return callback({ query: this.query.bind(this) });
    },
  };
  const service = createTelegramAuthService({
    db: database,
    config: { telegram: { apiId: 123, apiHash: 'app-hash' } },
    sourceRegistryService: {},
    connectionService: {},
    logger: { warn() {} },
    clientFactory: () => ({
      async connect() {},
      async disconnect() {},
      async sendCode() {
        const error = new Error('Telegram rejected the request');
        error.errorMessage = 'API_ID_PUBLISHED_FLOOD';
        throw error;
      },
    }),
  });

  await assert.rejects(
    service.sendCode({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      phoneNumber: '+12345678900',
    }),
    (error) => {
      assert.equal(error.code, 'TELEGRAM_API_ID_REVOKED');
      assert.equal(error.status, 409);
      assert.match(error.message, /Create a new Telegram app/);
      return true;
    },
  );
});

test('returns Telegram flood-wait errors as a retryable rate limit', async () => {
  const database = {
    async query(sql) {
      if (
        sql.includes('DELETE FROM telegram_auth_sessions') ||
        sql.includes('UPDATE telegram_auth_sessions SET status')
      ) {
        return { rows: [] };
      }
      if (sql.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE')) {
        return { rows: [{ id: 'user-id' }] };
      }
      if (sql.includes('SELECT count(*)::integer')) {
        return { rows: [{ count: 0, last_sent_at: null, oldest_at: null }] };
      }
      if (sql.includes('INSERT INTO telegram_auth_sessions')) {
        return { rows: [{ id: 'login-id' }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    tx(callback) {
      return callback({ query: this.query.bind(this) });
    },
  };
  const service = createTelegramAuthService({
    db: database,
    config: { telegram: { apiId: 123, apiHash: 'app-hash' } },
    sourceRegistryService: {},
    connectionService: {},
    logger: { warn() {} },
    clientFactory: () => ({
      async connect() {},
      async disconnect() {},
      async sendCode() {
        const error = new Error('Telegram flood wait');
        error.errorMessage = 'FLOOD_WAIT_60';
        throw error;
      },
    }),
  });

  await assert.rejects(
    service.sendCode({
      userId: 'user-id',
      workspaceId: 'workspace-id',
      phoneNumber: '+12345678900',
    }),
    (error) => {
      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal(error.status, 429);
      assert.deepEqual(error.details, { retryAfterSeconds: 60 });
      return true;
    },
  );
});

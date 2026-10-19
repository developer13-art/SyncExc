import { Api } from 'teleproto';
import {
  ConflictError,
  ExternalProviderError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../../lib/errors.js';
import { decrypt, encrypt } from '../../lib/crypto.js';
import {
  createTelegramClient,
  getTelegramPeer,
  listTelegramDialogs,
  requireTelegramCredentials,
  toTelegramInputPeer,
} from './telegram-client.js';

const LOGIN_TTL_MS = 15 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MINUTES = 15;
const SEND_COOLDOWN_SECONDS = 45;
const MAX_VERIFY_ATTEMPTS = 5;

function providerErrorCode(error) {
  return String(error?.errorMessage || error?.message || '').toUpperCase();
}

function mapTelegramSendCodeError(error) {
  const code = providerErrorCode(error);
  const floodWait = code.match(/FLOOD_WAIT_(\d+)/);
  if (floodWait) {
    const retryAfterSeconds = Number(floodWait[1]);
    return new RateLimitError(
      `Telegram is limiting login requests. Try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    );
  }
  if (code === 'FLOOD') {
    return new RateLimitError(
      'Telegram is limiting login-code requests. Wait before trying again.',
    );
  }
  if (code.includes('API_ID_PUBLISHED_FLOOD')) {
    return new ConflictError(
      'Telegram disabled this API ID because it was publicly exposed. Create a new Telegram app at my.telegram.org and update TELEGRAM_API_ID and TELEGRAM_API_HASH on the server.',
      'TELEGRAM_API_ID_REVOKED',
    );
  }
  if (code.includes('PHONE_NUMBER_INVALID')) {
    return new ValidationError(
      'Telegram rejected this phone number. Check that it is correct and includes the country code.',
    );
  }
  if (code.includes('PHONE_NUMBER_BANNED')) {
    return new ConflictError(
      'Telegram does not allow this phone number to sign in. Contact Telegram support.',
      'TELEGRAM_PHONE_NUMBER_BANNED',
    );
  }
  if (code.includes('PHONE_NUMBER_UNOCCUPIED')) {
    return new ValidationError(
      'This phone number is not registered to a Telegram account. Create the account in the official Telegram app first.',
    );
  }
  if (code.includes('PHONE_NUMBER_FLOOD') || code.includes('PHONE_CODE_FLOOD')) {
    return new RateLimitError(
      'Telegram is limiting login requests for this phone number. Wait before trying again.',
    );
  }
  if (code.includes('SEND_CODE_UNAVAILABLE')) {
    return new ConflictError(
      'Telegram has no available delivery method for a login code to this number. Try again later or sign in using the official Telegram app.',
      'TELEGRAM_CODE_UNAVAILABLE',
    );
  }
  if (code.includes('PHONE_NUMBER_APP_SIGNUP_FORBIDDEN')) {
    return new ConflictError(
      'Telegram does not allow this account to sign in from third-party apps. Try the official Telegram app.',
      'TELEGRAM_APP_SIGNUP_FORBIDDEN',
    );
  }
  if (code.includes('API_ID_INVALID') || code.includes('API_HASH_INVALID')) {
    return new ConflictError(
      'Telegram login is not configured correctly. Please contact support.',
      'TELEGRAM_CONFIGURATION_ERROR',
    );
  }
  const transportCode = String(error?.code || '').toUpperCase();
  if (
    ['ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNREFUSED', 'EAI_AGAIN'].includes(
      transportCode,
    ) ||
    error?.name === 'TimeoutError'
  ) {
    return new ExternalProviderError(
      'The server could not reach Telegram to request a login code. Please try again later.',
      { provider: 'telegram', retryable: true, status: 502 },
    );
  }
  return new ExternalProviderError(
    'Telegram could not process the login-code request. Check the phone number and try again later.',
    { provider: 'telegram', retryable: true, status: 502 },
  );
}

function safeProviderErrorCode(error) {
  const raw = String(error?.errorMessage || error?.code || '').toUpperCase();
  const code = raw.match(/\b[A-Z][A-Z0-9_]{1,63}\b/)?.[0];
  return code ?? 'UNKNOWN';
}

function normalizePhoneNumber(value) {
  const phone = String(value || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new ValidationError(
      'Enter a valid Telegram phone number in international format, such as +12345678900.',
    );
  }
  return phone;
}

function serializeSession(state, client) {
  return { ...state, sessionString: client.session.save() };
}

export function createTelegramAuthService({
  db,
  config,
  sourceRegistryService,
  connectionService,
  logger,
  clientFactory = createTelegramClient,
}) {
  const apiCredentials = () => requireTelegramCredentials(config);

  async function reserveLogin(userId, workspaceId) {
    await db.query('DELETE FROM telegram_auth_sessions WHERE expires_at <= now()');
    return db.tx(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const result = await tx.query(
        `
        SELECT count(*)::integer AS count,
               max(created_at) AS last_sent_at,
               min(created_at) AS oldest_at
        FROM telegram_auth_sessions
        WHERE user_id = $1
          AND created_at >= now() - ($2::text || ' minutes')::interval
          AND status IN ('request_pending', 'code_sent', 'password_required', 'verified')
        `,
        [userId, SEND_WINDOW_MINUTES],
      );
      const {
        count,
        last_sent_at: lastSentAt,
        oldest_at: oldestAt,
      } = result.rows[0];
      if (Number(count) >= MAX_SENDS_PER_WINDOW) {
        const retryAfterSeconds = oldestAt
          ? Math.max(
              1,
              Math.ceil(
                (new Date(oldestAt).getTime() +
                  SEND_WINDOW_MINUTES * 60_000 -
                  Date.now()) /
                  1000,
              ),
            )
          : SEND_WINDOW_MINUTES * 60;
        throw new RateLimitError(
          `Too many Telegram login codes were requested. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
          retryAfterSeconds,
        );
      }
      if (lastSentAt) {
        const retryAfterSeconds = Math.ceil(
          (new Date(lastSentAt).getTime() +
            SEND_COOLDOWN_SECONDS * 1000 -
            Date.now()) /
            1000,
        );
        if (retryAfterSeconds > 0) {
          throw new RateLimitError(
            `Wait ${retryAfterSeconds} seconds before requesting another Telegram login code.`,
            retryAfterSeconds,
          );
        }
      }
      const saved = await tx.query(
        `
        INSERT INTO telegram_auth_sessions
          (user_id, workspace_id, encrypted_state, status, expires_at)
        VALUES ($1, $2, $3, 'request_pending', now() + ($4::text || ' milliseconds')::interval)
        RETURNING id
        `,
        [userId, workspaceId, encrypt('{}'), LOGIN_TTL_MS],
      );
      return saved.rows[0].id;
    });
  }

  async function sendCode({ userId, workspaceId, phoneNumber }) {
    const phone = normalizePhoneNumber(phoneNumber);
    const credentials = apiCredentials();
    const loginId = await reserveLogin(userId, workspaceId);

    const client = clientFactory('', config);
    try {
      let result;
      try {
        await client.connect();
        result = await client.sendCode(credentials, phone);
      } catch (error) {
        await db.query(
          `UPDATE telegram_auth_sessions SET status = 'request_failed', updated_at = now() WHERE id = $1`,
          [loginId],
        );
        logger.warn(
          {
            provider: 'telegram',
            errorName: error?.name,
            providerErrorCode: safeProviderErrorCode(error),
          },
          'Telegram login code request failed',
        );
        throw mapTelegramSendCodeError(error);
      }
      if (result.emailRequired || result.emailCodeSent || !result.phoneCodeHash) {
        await db.query(
          `UPDATE telegram_auth_sessions SET status = 'request_failed', updated_at = now() WHERE id = $1`,
          [loginId],
        );
        throw new ConflictError(
          'Telegram requires an email verification/setup step that is not supported yet. Complete account setup in the official app, then try again.',
          'TELEGRAM_EMAIL_SETUP_REQUIRED',
        );
      }
      const state = {
        phoneNumber: phone,
        phoneCodeHash: result.phoneCodeHash,
        sessionString: client.session.save(),
      };
      await db.query(
        `UPDATE telegram_auth_sessions SET encrypted_state = $2, status = 'code_sent', updated_at = now() WHERE id = $1`,
        [loginId, encrypt(JSON.stringify(state))],
      );
      return {
        loginId,
        delivery: result.isCodeViaApp ? 'telegram_app' : 'sms',
        expiresInSeconds: LOGIN_TTL_MS / 1000,
      };
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  async function getLogin({ loginId, userId, workspaceId, requiredStatus }) {
    const result = await db.query(
      `
      SELECT id, encrypted_state, status, attempts
      FROM telegram_auth_sessions
      WHERE id = $1 AND user_id = $2 AND workspace_id = $3 AND expires_at > now()
      `,
      [loginId, userId, workspaceId],
    );
    const login = result.rows[0];
    if (!login || (requiredStatus && !requiredStatus.includes(login.status))) {
      throw new NotFoundError('Telegram login session');
    }
    return {
      row: login,
      state: JSON.parse(decrypt(login.encrypted_state)),
    };
  }

  async function verifyCode({ loginId, userId, workspaceId, code, password }) {
    const login = await getLogin({
      loginId,
      userId,
      workspaceId,
      requiredStatus: ['code_sent', 'password_required'],
    });
    if (login.row.attempts >= MAX_VERIFY_ATTEMPTS) {
      await db.query('DELETE FROM telegram_auth_sessions WHERE id = $1', [loginId]);
      throw new ConflictError(
        'Too many verification attempts. Request a new Telegram code.',
        'TELEGRAM_ATTEMPTS_EXCEEDED',
      );
    }

    const attempt = await db.query(
      `
      UPDATE telegram_auth_sessions
      SET attempts = attempts + 1, updated_at = now()
      WHERE id = $1 AND attempts < $2
      RETURNING attempts
      `,
      [loginId, MAX_VERIFY_ATTEMPTS],
    );
    if (!attempt.rows[0]) {
      throw new ConflictError(
        'Too many verification attempts. Request a new Telegram code.',
        'TELEGRAM_ATTEMPTS_EXCEEDED',
      );
    }

    const client = clientFactory(login.state.sessionString, config);
    try {
      await client.connect();
      if (login.row.status === 'password_required') {
        if (!password) return { requiresPassword: true };
        await client.signInWithPassword(apiCredentials(), {
          password: async () => password,
          onError: () => true,
        });
      } else {
        const normalizedCode = String(code || '').trim();
        if (!/^\d{4,8}$/.test(normalizedCode)) {
          throw new ValidationError('Enter the Telegram verification code.');
        }
        try {
          await client.invoke(
            new Api.auth.SignIn({
              phoneNumber: login.state.phoneNumber,
              phoneCodeHash: login.state.phoneCodeHash,
              phoneCode: normalizedCode,
            }),
          );
        } catch (error) {
          if (providerErrorCode(error).includes('SESSION_PASSWORD_NEEDED')) {
            const state = serializeSession(login.state, client);
            await db.query(
              `UPDATE telegram_auth_sessions SET status = 'password_required', encrypted_state = $2, updated_at = now() WHERE id = $1`,
              [loginId, encrypt(JSON.stringify(state))],
            );
            return { requiresPassword: true };
          }
          throw error;
        }
      }

      if (!(await client.checkAuthorization())) {
        throw new Error('Telegram authorization was not completed');
      }
      const user = await client.getMe();
      const state = serializeSession(login.state, client);
      await db.query(
        `
        UPDATE telegram_auth_sessions
        SET status = 'verified', encrypted_state = $2,
            expires_at = now() + ($3::text || ' milliseconds')::interval,
            updated_at = now()
        WHERE id = $1
        `,
        [loginId, encrypt(JSON.stringify(state)), LOGIN_TTL_MS],
      );
      return {
        verified: true,
        accountName:
          [user.firstName, user.lastName].filter(Boolean).join(' ') ||
          user.username ||
          'Telegram account',
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) throw error;
      logger.warn(
        { provider: 'telegram', errorName: error?.name },
        'Telegram login verification failed',
      );
      if (providerErrorCode(error).includes('PHONE_CODE')) {
        throw new ValidationError(
          'The Telegram code is incorrect or expired. Request a new code and try again.',
        );
      }
      if (login.row.status === 'password_required') {
        throw new ValidationError('The Telegram two-step verification password is incorrect.');
      }
      throw new ConflictError(
        'Telegram could not verify this login. Request a new code and try again.',
        'TELEGRAM_LOGIN_FAILED',
      );
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  async function listChannels({ loginId, userId, workspaceId }) {
    const login = await getLogin({
      loginId,
      userId,
      workspaceId,
      requiredStatus: ['verified'],
    });
    const client = clientFactory(login.state.sessionString, config);
    try {
      await client.connect();
      if (!(await client.checkAuthorization())) {
        throw new ConflictError(
          'Telegram authorization expired. Connect Telegram again.',
          'TELEGRAM_SESSION_EXPIRED',
        );
      }
      return await listTelegramDialogs(client);
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      logger.warn(
        { provider: 'telegram', errorName: error?.name },
        'Telegram channel listing failed',
      );
      throw new ConflictError(
        'Telegram could not load your channels. Try again.',
        'TELEGRAM_CHANNEL_LIST_FAILED',
      );
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  async function createSources({ loginId, userId, workspaceId, channelIds }) {
    const login = await getLogin({
      loginId,
      userId,
      workspaceId,
      requiredStatus: ['verified'],
    });
    const client = clientFactory(login.state.sessionString, config);
    const selectedIds = new Set(channelIds);
    const createdSources = [];
    try {
      await client.connect();
      if (!(await client.checkAuthorization())) {
        throw new ConflictError(
          'Telegram authorization expired. Connect Telegram again.',
          'TELEGRAM_SESSION_EXPIRED',
        );
      }
      const dialogs = await client.getDialogs({ limit: 500 });
      const selected = dialogs.flatMap((dialog) => {
        const peer = getTelegramPeer(dialog.entity);
        if (!peer) return [];
        const id = `${peer.type}:${peer.id}`;
        if (!selectedIds.has(id)) return [];
        return [{ dialog, peer, id }];
      });
      if (selected.length !== selectedIds.size) {
        throw new ValidationError(
          'One or more selected Telegram channels are no longer available. Reload the channel list.',
        );
      }

      const prepared = await Promise.all(
        selected.map(async ({ dialog, peer, id }) => {
          const inputPeer = toTelegramInputPeer(peer);
          const latestMessages = await client.getMessages(inputPeer, { limit: 1 });
          return {
            dialog,
            peer,
            identifier: `telegram:${id}`,
            lastMessageId: Number(latestMessages[0]?.id || 0),
          };
        }),
      );

      for (const item of prepared) {
        const username = item.dialog.entity.username || null;
        const source = await sourceRegistryService.registerSource({
          userId,
          workspaceId,
          type: 'telegram',
          name: item.dialog.title || item.dialog.entity.title || 'Telegram source',
          identifier: item.identifier,
          url: username ? `https://t.me/${username}` : undefined,
          providerName: 'Telegram',
          accessMethod: 'telegram_user',
        });
        await connectionService.authorize({
          userId,
          workspaceId,
          sourceId: source.id,
          credentials: {
            sessionString: login.state.sessionString,
            selectedPeer: item.peer,
          },
        });
        await db.query(
          `
          INSERT INTO telegram_user_message_cursors (source_id, last_message_id)
          VALUES ($1, $2)
          ON CONFLICT (source_id) DO UPDATE
          SET last_message_id = EXCLUDED.last_message_id, updated_at = now()
          `,
          [source.id, item.lastMessageId],
        );
        createdSources.push(source);
      }

      await db.query('DELETE FROM telegram_auth_sessions WHERE id = $1', [loginId]);
      return createdSources;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) throw error;
      logger.warn(
        { provider: 'telegram', errorName: error?.name, createdCount: createdSources.length },
        'Telegram source registration failed',
      );
      throw error;
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  async function cancel({ loginId, userId, workspaceId }) {
    await db.query(
      `DELETE FROM telegram_auth_sessions WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
      [loginId, userId, workspaceId],
    );
    return { ok: true };
  }

  return { sendCode, verifyCode, listChannels, createSources, cancel };
}

export default createTelegramAuthService;

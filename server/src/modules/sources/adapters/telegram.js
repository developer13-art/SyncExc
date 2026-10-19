/**
 * SyncExc Server — Telegram source adapter
 *
 * Uses the Telegram Bot API for messages. For channel monitoring, the user
 * authorizes a bot to the channel or provides the bot token.
 */

import { createLogger } from '../../../lib/logger.js';
import { createTelegramClient, toTelegramInputPeer } from '../telegram-client.js';

async function request(token, method, params = {}) {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    // Never surface a URL, bot token, or raw provider response in errors.
    throw new Error(`Telegram ${method} request failed (${data?.error_code ?? response.status})`);
  }
  return data.result;
}

export function createTelegramAdapter({ logger, config, db }) {
  const log = logger || createLogger({ component: 'sources:telegram' });

  async function verifyUserSession(credentials) {
    if (!credentials?.sessionString || !credentials?.selectedPeer) {
      throw new Error('Telegram user session and selected channel are required');
    }
    const client = createTelegramClient(credentials.sessionString, config);
    try {
      await client.connect();
      if (!(await client.checkAuthorization())) {
        throw new Error('Telegram authorization expired. Connect Telegram again.');
      }
      const peer = toTelegramInputPeer(credentials.selectedPeer);
      const messages = await client.getMessages(peer, { limit: 1 });
      const user = await client.getMe();
      return {
        user,
        messages,
      };
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  async function getSelectedChat(sourceId) {
    const result = await db.query(
      `
      SELECT value
      FROM signal_source_identifiers
      WHERE source_id = $1 AND canonical = true
      ORDER BY created_at
      LIMIT 1
      `,
      [sourceId],
    );
    if (!result.rows[0]?.value) throw new Error('Select a channel or group before connecting');
    return result.rows[0].value;
  }

  async function verifyBotCanRead(token, chatRef) {
    const bot = await request(token, 'getMe');
    const chat = await request(token, 'getChat', { chat_id: chatRef });
    const membership = await request(token, 'getChatMember', {
      chat_id: chat.id,
      user_id: bot.id,
    });
    const allowed =
      ['administrator', 'creator'].includes(membership.status) ||
      (chat.type !== 'channel' && membership.status === 'member');
    if (!allowed) {
      throw new Error('Add the bot to this selected chat before connecting it');
    }
    return { bot, chat };
  }

  return {
    type: 'telegram',

    async authorize({ source, credentials }) {
      if (credentials?.sessionString) {
        const { user } = await verifyUserSession(credentials);
        return {
          metadata: {
            connectionType: 'telegram_user',
            accountName:
              [user.firstName, user.lastName].filter(Boolean).join(' ') ||
              user.username ||
              'Telegram account',
          },
        };
      }
      if (!credentials?.botToken) {
        throw new Error('Telegram user login or bot token is required');
      }
      const chatRef = await getSelectedChat(source.id);
      const { bot, chat } = await verifyBotCanRead(credentials.botToken, chatRef);

      return {
        metadata: {
          botId: bot.id,
          botUsername: bot.username,
          chatId: chat.id,
          chatTitle: chat.title || chat.username || String(chat.id),
        },
      };
    },

    async testConnection({ source, connection, credentials }) {
      if (credentials?.sessionString) {
        if (!connection || connection.status !== 'active') {
          return {
            reachable: false,
            hasContent: false,
            parseable: false,
            connectivityMessage: 'Connection not active',
          };
        }
        try {
          const { user, messages } = await verifyUserSession(credentials);
          return {
            reachable: true,
            hasContent: messages.length > 0,
            parseable: true,
            lastEventAt: messages[0]?.date ?? null,
            connectivityMessage: 'Telegram user account can access the selected channel',
            contentMessage: `${source.name} is selected; polling starts when monitoring is enabled`,
            formatMessage: 'Text and captions are parsed; media files are not downloaded',
            summary: { accountName: user.username || user.firstName || 'Telegram account' },
          };
        } catch (err) {
          return {
            reachable: false,
            hasContent: false,
            parseable: false,
            connectivityMessage: err.message || 'Telegram connection test failed',
          };
        }
      }
      if (!connection || connection.status !== 'active' || !credentials?.botToken) {
        return {
          reachable: false,
          hasContent: false,
          parseable: false,
          connectivityMessage: 'Connection not active',
        };
      }

      // Check for recent updates
      try {
        const chatRef = await getSelectedChat(source.id);
        const { bot, chat } = await verifyBotCanRead(credentials.botToken, chatRef);

        return {
          reachable: true,
          hasContent: false,
          parseable: true,
          lastEventAt: null,
          connectivityMessage: 'Bot can access the selected chat',
          contentMessage: `${chat.title || chat.username || chat.id} is selected; polling only starts when monitoring is enabled`,
          formatMessage: 'Text and captions are parsed; media files are not downloaded',
          summary: { botUsername: bot.username, chatId: chat.id, chatType: chat.type },
        };
      } catch (err) {
        return {
          reachable: false,
          hasContent: false,
          parseable: false,
          connectivityMessage: err.message || 'Telegram connection test failed',
        };
      }
    },

    async fetchSampleMessages() {
      // The bot API does not provide channel history. Monitoring uses getUpdates
      // only after a user explicitly enables a selected source.
      return [];
    },

    async parseMessage(message) {
      // Extract structured signal data from a Telegram message
      return {
        text: message.text,
        timestamp: message.date,
        channel: message.chat?.id,
      };
    },
  };
}

export default createTelegramAdapter;

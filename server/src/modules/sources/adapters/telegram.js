/** Telegram user-account source adapter. Telegram bots are not supported here. */

import { createTelegramClient, toTelegramInputPeer } from '../telegram-client.js';

export function createTelegramAdapter({ logger, config, db }) {
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

  return {
    type: 'telegram',

    async authorize({ source, credentials }) {
      const { user } = await verifyUserSession(credentials);
      return {
        metadata: {
          connectionType: 'telegram_user',
          accountName:
            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
            user.username ||
            'Telegram account',
          selectedSource: source.name,
        },
      };
    },

    async testConnection({ source, connection, credentials }) {
      if (!connection || connection.status !== 'active' || !credentials?.sessionString) {
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
          connectivityMessage: 'Telegram user account can access the selected chat',
          contentMessage: `${source.name} is selected for monitoring`,
          formatMessage: 'Text and captions are parsed; media files are not downloaded',
          summary: { accountName: user.username || user.firstName || 'Telegram account' },
        };
      } catch (err) {
        logger?.warn?.({ sourceId: source.id, errorName: err?.name }, 'Telegram connection check failed');
        return {
          reachable: false,
          hasContent: false,
          parseable: false,
          connectivityMessage: err.message || 'Telegram connection test failed',
        };
      }
    },

    async fetchSampleMessages() {
      return [];
    },

    async parseMessage(message) {
      return {
        text: message.message || message.text || message.caption || '',
        timestamp: message.date,
        channel: message.channelRef,
      };
    },
  };
}

export default createTelegramAdapter;

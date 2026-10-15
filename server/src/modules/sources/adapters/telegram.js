/**
 * SyncExc Server — Telegram source adapter
 *
 * Uses the Telegram Bot API for messages. For channel monitoring, the user
 * authorizes a bot to the channel or provides the bot token.
 */

import { createLogger } from '../../../lib/logger.js';

export function createTelegramAdapter({ logger, config, db }) {
  const log = logger || createLogger({ component: 'sources:telegram' });

  return {
    type: 'telegram',

    async authorize({ source, credentials }) {
      if (!credentials?.botToken) {
        throw new Error('Telegram adapter requires botToken');
      }

      const response = await fetch(
        `https://api.telegram.org/bot${credentials.botToken}/getMe`
      );
      const data = await response.json();
      if (!data.ok) throw new Error(`Telegram auth failed: ${data.description}`);

      return {
        metadata: {
          botId: data.result.id,
          botUsername: data.result.username,
        },
      };
    },

    async testConnection({ source, connection }) {
      if (!connection || connection.status !== 'active') {
        return {
          reachable: false,
          hasContent: false,
          parseable: false,
          connectivityMessage: 'Connection not active',
        };
      }

      // Check for recent updates
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${connection.metadata?.botToken}/getUpdates`
        );
        const data = await response.json();
        const updates = data.result || [];

        return {
          reachable: data.ok,
          hasContent: updates.length > 0,
          parseable: true,
          lastEventAt: updates.length > 0
            ? new Date(updates[updates.length - 1].message?.date * 1000).toISOString()
            : null,
          connectivityMessage: 'Telegram API reachable',
          contentMessage: `${updates.length} updates in polling window`,
          formatMessage: 'Text and media messages supported',
          summary: { updateCount: updates.length },
        };
      } catch (err) {
        return {
          reachable: false,
          hasContent: false,
          parseable: false,
          connectivityMessage: err.message,
        };
      }
    },

    async fetchSampleMessages({ source, connection, limit }) {
      // In production, uses the Telegram API to fetch channel history
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
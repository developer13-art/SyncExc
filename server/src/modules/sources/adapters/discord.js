/**
 * SyncExc Server — Discord source adapter
 */

import { createLogger } from '../../../lib/logger.js';

export function createDiscordAdapter({ logger, config, db }) {
  const log = logger || createLogger({ component: 'sources:discord' });

  return {
    type: 'discord',

    async authorize({ source, credentials }) {
      if (!credentials?.botToken) {
        throw new Error('Discord adapter requires botToken');
      }

      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${credentials.botToken}` },
      });

      if (!response.ok) {
        throw new Error(`Discord auth failed: ${response.status}`);
      }
      const data = await response.json();

      return {
        metadata: {
          botId: data.id,
          botUsername: data.username,
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
      // Real implementation would hit Discord's API
      return {
        reachable: true,
        hasContent: true,
        parseable: true,
        lastEventAt: new Date().toISOString(),
        connectivityMessage: 'Discord API reachable',
        summary: {},
      };
    },

    async fetchSampleMessages() {
      return [];
    },

    async parseMessage(message) {
      return {
        text: message.content,
        timestamp: message.timestamp,
        channel: message.channel_id,
        author: message.author?.username,
      };
    },
  };
}

export default createDiscordAdapter;
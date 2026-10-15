/**
 * SyncExc Server — WhatsApp source adapter
 *
 * Uses WhatsApp Cloud API (official Meta product). Group access is not
 * always available; only authorized integrations are supported.
 */

import { createLogger } from '../../../lib/logger.js';

export function createWhatsAppAdapter({ logger, config, db }) {
  const log = logger || createLogger({ component: 'sources:whatsapp' });

  return {
    type: 'whatsapp',

    async authorize({ source, credentials }) {
      if (!credentials?.accessToken || !credentials?.phoneNumberId) {
        throw new Error('WhatsApp adapter requires accessToken and phoneNumberId');
      }

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}`,
        { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
      );

      if (!response.ok) {
        throw new Error(`WhatsApp auth failed: ${response.status}`);
      }
      const data = await response.json();

      return {
        metadata: {
          phoneNumberId: credentials.phoneNumberId,
          displayPhoneNumber: data.display_phone_number,
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
      return {
        reachable: true,
        hasContent: false, // WhatsApp doesn't expose history via API
        parseable: true,
        connectivityMessage: 'Cloud API reachable',
        contentMessage: 'WhatsApp messages arrive via webhook',
        summary: {},
      };
    },

    async fetchSampleMessages() {
      return [];
    },

    async parseMessage(message) {
      return {
        text: message.text?.body,
        timestamp: message.timestamp,
        from: message.from,
      };
    },
  };
}

export default createWhatsAppAdapter;
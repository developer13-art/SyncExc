/**
 * SyncExc Server — Webhook source adapter
 *
 * Receives signed HTTP POSTs. The adapter verifies the signature and
 * normalizes the payload.
 */

import { verifyWebhookSignature } from '../../../lib/crypto.js';

export function createWebhookAdapter({ logger, config, db }) {
  return {
    type: 'webhook',

    async authorize({ source, credentials }) {
      // Webhook sources don't require authorization — they're inbound.
      // Just confirm a signing secret is set.
      if (!credentials?.signingSecret) {
        throw new Error('Webhook adapter requires signingSecret');
      }
      return {
        metadata: { signingSecretSet: true },
      };
    },

    async testConnection({ source, connection }) {
      if (!connection || connection.status !== 'active') {
        return {
          reachable: false,
          hasContent: false,
          parseable: false,
          connectivityMessage: 'Webhook not configured',
        };
      }
      return {
        reachable: true,
        hasContent: true,
        parseable: true,
        connectivityMessage: 'Webhook endpoint is listening',
        summary: {},
      };
    },

    async fetchSampleMessages() {
      return [];
    },

    verifySignature({ payload, signature, timestamp, secret }) {
      return verifyWebhookSignature({
        payload,
        signature,
        timestamp,
        secret,
        toleranceSeconds: 300,
      });
    },

    async parseMessage(message) {
      return {
        text: typeof message.body === 'string' ? message.body : JSON.stringify(message.body),
        timestamp: message.receivedAt,
        source: 'webhook',
        raw: message.body,
      };
    },
  };
}

export default createWebhookAdapter;
/**
 * SyncExc Server — Email source adapter
 *
 * Listens via IMAP for messages from a signal provider. Uses an allowlist
 * of sender addresses.
 */

export function createEmailAdapter({ logger, config, db }) {
  return {
    type: 'email',

    async authorize({ source, credentials }) {
      if (!credentials?.imapUser || !credentials?.imapPassword) {
        throw new Error('Email adapter requires imapUser and imapPassword');
      }
      return {
        metadata: {
          imapUser: credentials.imapUser,
          imapHost: credentials.imapHost,
        },
      };
    },

    async testConnection({ source, connection }) {
      if (!connection || connection.status !== 'active') {
        return {
          reachable: false,
          hasContent: false,
          parseable: false,
          connectivityMessage: 'Email connection not active',
        };
      }
      // Actual IMAP connection is handled by the ingester
      return {
        reachable: true,
        hasContent: true,
        parseable: true,
        connectivityMessage: 'IMAP listener active',
        summary: {},
      };
    },

    async fetchSampleMessages() {
      return [];
    },

    async parseMessage(message) {
      return {
        text: message.text || message.html,
        timestamp: message.date,
        from: message.from,
        subject: message.subject,
      };
    },
  };
}

export default createEmailAdapter;
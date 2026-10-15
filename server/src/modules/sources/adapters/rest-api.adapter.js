/**
 * SyncExc Server — REST API source adapter
 */

export function createRestApiAdapter({ logger, config, db }) {
  return {
    type: 'rest_api',

    async authorize({ source, credentials }) {
      if (credentials?.apiKey) {
        // Verify the API key works
        try {
          const response = await fetch(source.url, {
            headers: { Authorization: `Bearer ${credentials.apiKey}` },
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (err) {
          throw new Error(`REST API auth failed: ${err.message}`);
        }
      }
      return { metadata: { hasApiKey: Boolean(credentials?.apiKey) } };
    },

    async testConnection({ source, connection }) {
      try {
        const headers = {};
        if (connection?.metadata?.hasApiKey) {
          headers.Authorization = `Bearer ${connection.metadata.apiKey}`;
        }
        const response = await fetch(source.url, {
          headers,
          signal: AbortSignal.timeout(10000),
        });

        return {
          reachable: response.ok,
          hasContent: response.ok,
          parseable: true,
          connectivityMessage: response.ok ? 'REST API reachable' : `HTTP ${response.status}`,
          summary: { status: response.status },
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

    async fetchSampleMessages() {
      return [];
    },

    async parseMessage(message) {
      return {
        text: JSON.stringify(message.body),
        timestamp: message.receivedAt,
        raw: message.body,
      };
    },
  };
}

export default createRestApiAdapter;
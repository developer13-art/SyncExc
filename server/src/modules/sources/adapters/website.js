/**
 * SyncExc Server — Website source adapter
 *
 * Fetches public web content (feeds, public pages). No scraping of
 * authenticated content, no bypassing robots.txt.
 */

export function createWebsiteAdapter({ logger, config, db }) {
  return {
    type: 'website',

    async authorize({ source, credentials }) {
      // Websites are usually public; no credentials required
      return { metadata: {} };
    },

    async testConnection({ source, connection }) {
      try {
        const response = await fetch(source.url, {
          headers: { 'User-Agent': 'SyncExc/1.0 (+https://syncexc.com/bot)' },
          signal: AbortSignal.timeout(10000),
        });

        return {
          reachable: response.ok,
          hasContent: response.ok,
          parseable: true,
          lastEventAt: response.headers.get('last-modified'),
          connectivityMessage: response.ok ? 'Website reachable' : `HTTP ${response.status}`,
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
        text: message.text,
        timestamp: message.publishedAt,
      };
    },
  };
}

export default createWebsiteAdapter;
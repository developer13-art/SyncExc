/**
 * SyncExc Server — Source adapter registry
 */

import { createLogger } from '../../../lib/logger.js';
import { createTelegramAdapter } from './telegram.adapter.js';
import { createDiscordAdapter } from './discord.adapter.js';
import { createWhatsAppAdapter } from './whatsapp.adapter.js';
import { createWebhookAdapter } from './webhook.adapter.js';
import { createWebsiteAdapter } from './website.adapter.js';
import { createRestApiAdapter } from './rest-api.adapter.js';
import { createEmailAdapter } from './email.adapter.js';

export function createSourceAdapterRegistry({ logger, config, db }) {
  const log = logger || createLogger({ component: 'sources:adapters' });

  const adapters = new Map();
  const discoveryProviders = new Map();

  adapters.set('telegram', createTelegramAdapter({ logger: log, config, db }));
  adapters.set('discord', createDiscordAdapter({ logger: log, config, db }));
  adapters.set('whatsapp', createWhatsAppAdapter({ logger: log, config, db }));
  adapters.set('webhook', createWebhookAdapter({ logger: log, config, db }));
  adapters.set('website', createWebsiteAdapter({ logger: log, config, db }));
  adapters.set('rest_api', createRestApiAdapter({ logger: log, config, db }));
  adapters.set('email', createEmailAdapter({ logger: log, config, db }));

  // Register discovery providers (external directories, platform search APIs)
  discoveryProviders.set('platform-search', {
    name: 'platform-search',
    async search(filters) {
      // In production, this would query approved discovery APIs
      return [];
    },
  });

  log.info(
    { adapters: Array.from(adapters.keys()) },
    'Source adapter registry initialized'
  );

  return {
    get(type) {
      return adapters.get(type) || null;
    },
    list() {
      return Array.from(adapters.keys());
    },
    listDiscoveryProviders() {
      return Array.from(discoveryProviders.keys());
    },
    getDiscoveryProvider(name) {
      return discoveryProviders.get(name) || null;
    },
  };
}

export default createSourceAdapterRegistry;
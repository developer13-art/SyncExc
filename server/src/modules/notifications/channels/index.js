/**
 * SyncExc Server — Channel registry
 */

import { createLogger } from '../../../lib/logger.js';
import { createInAppChannel } from './in-app.channel.js';
import { createEmailChannel } from './email.channel.js';
import { createPushChannel } from './push.channel.js';
import { createWebhookChannel } from './webhook.channel.js';

export function createChannelRegistry({ logger, mailer, push, db, queries, deviceService }) {
  const log = logger || createLogger({ component: 'notifications:channels' });

  const channels = {
    in_app: createInAppChannel({ db, queries, logger: log }),
    email: createEmailChannel({ mailer, logger: log }),
    push: createPushChannel({ push, db, queries, deviceService, logger: log }),
    webhook: createWebhookChannel({ db, queries, logger: log }),
  };

  log.debug({ channels: Object.keys(channels) }, 'Channel registry initialized');

  return channels;
}

export default createChannelRegistry;
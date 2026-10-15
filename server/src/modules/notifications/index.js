/**
 * SyncExc Server — Notifications module (Module 16)
 *
 * Owns:
 *   - event registry and validation
 *   - notification orchestration (fan-out, priority, dedup, grouping)
 *   - channel adapters (in-app, email, push, webhook)
 *   - templates and localization
 *   - user preferences and quiet hours
 *   - delivery tracking, retries, dead-letter
 *   - escalation policies
 *   - operational metrics
 *
 * Public API:
 *   notifications.service.create(params)      — create a notification
 *   notifications.orchestrator.processEvent   — process a raw event
 *   notifications.channels.{email,push,inapp} — direct channel sends
 */

import { createNotificationQueries } from './notifications.queries.js';
import { createEventRegistry } from './event-registry.service.js';
import { createTemplateService } from './templates.js';
import { createPreferencesService } from './preferences.service.js';
import { createDeduplicationService } from './deduplication.service.js';
import { createPriorityService } from './priority.service.js';
import { createOrchestratorService } from './orchestrator.service.js';
import { createNotificationService } from './notifications.service.js';
import { createDeliveryService } from './delivery.service.js';
import { createDeviceService } from './device.service.js';
import { createEscalationService } from './escalation.service.js';
import { createUsageService } from './usage.service.js';
import { createChannelRegistry } from './channels/index.js';
import { createNotificationRoutes } from './notifications.routes.js';
import { createNotificationListeners } from './listeners.js';
import { createLogger } from '../../lib/logger.js';

export function createNotificationsModule({ services }) {
  const logger = createLogger({ component: 'notifications' });

  const queries = createNotificationQueries({ db: services.db });

  const eventRegistry = createEventRegistry({ queries, logger });
  const templateService = createTemplateService({ db: services.db, queries, logger });
  const preferencesService = createPreferencesService({ db: services.db, queries, logger });
  const deduplicationService = createDeduplicationService({ db: services.db, queries, logger });
  const priorityService = createPriorityService({ logger });
  const deviceService = createDeviceService({ db: services.db, queries, logger });
  const escalationService = createEscalationService({ db: services.db, queries, events: services.events, logger });
  const usageService = createUsageService({ db: services.db, queries, logger });

  const channels = createChannelRegistry({
    logger,
    mailer: services.mailer,
    push: services.push,
    db: services.db,
    queries,
    deviceService,
  });

  const deliveryService = createDeliveryService({
    db: services.db,
    queries,
    channels,
    templateService,
    preferencesService,
    deduplicationService,
    deviceService,
    events: services.events,
    logger,
  });

  const notificationService = createNotificationService({
    db: services.db,
    queries,
    deliveryService,
    events: services.events,
    realtime: services.realtime,
    logger,
  });

  const orchestrator = createOrchestratorService({
    db: services.db,
    queries,
    eventRegistry,
    templateService,
    preferencesService,
    deduplicationService,
    priorityService,
    notificationService,
    deliveryService,
    escalationService,
    usageService,
    events: services.events,
    logger,
  });

  const routes = createNotificationRoutes({
    notificationService,
    preferencesService,
    deviceService,
    deliveryService,
    eventRegistry,
    templateService,
    escalationService,
    usageService,
    middleware: services.middleware,
  });

  const listeners = createNotificationListeners({
    events: services.events,
    orchestrator,
    logger,
  });

  const publicApi = {
    service: {
      create: (params) => notificationService.create(params),
    },
    orchestrator: {
      processEvent: (event) => orchestrator.processEvent(event),
    },
    channels: {
      email: (params) => channels.email.send(params),
      push: (params) => channels.push.send(params),
      inapp: (params) => channels.inapp.send(params),
    },
    events: {
      registerEventType: (def) => eventRegistry.register(def),
      listEventTypes: () => eventRegistry.list(),
    },
  };

  return {
    name: 'notifications',
    routes,
    queries,
    service: notificationService,
    orchestrator,
    delivery: deliveryService,
    channels,
    eventRegistry,
    template: templateService,
    preferences: preferencesService,
    deduplication: deduplicationService,
    priority: priorityService,
    device: deviceService,
    escalation: escalationService,
    usage: usageService,
    publicApi,

    async shutdown() {
      logger.debug('Notifications module shutdown');
    },
  };
}

export default createNotificationsModule;
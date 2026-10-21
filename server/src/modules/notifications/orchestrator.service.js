/**
 * SyncExc Server — Notification orchestrator
 *
 * The orchestrator consumes domain events and produces notifications.
 * For each event:
 *   1. Look up the event type in the registry
 *   2. Determine recipients (from event payload)
 *   3. For each recipient:
 *      a. Compute the effective priority
 *      b. Build the deduplication key
 *      c. Skip if duplicate
 *      d. Render the template
 *      e. Persist the notification
 *      f. Enqueue deliveries per channel
 */

export function createOrchestratorService({
  db,
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
  events,
  logger,
}) {
  /**
   * Process a raw domain event. This is the entry point for every event that
   * should potentially produce a notification.
   *
   * @param {Object} event
   * @param {string} event.eventType
   * @param {Object} event.payload
   * @param {string} [event.actorId]
   * @param {string} [event.workspaceId]
   * @param {string} [event.resourceType]
   * @param {string} [event.resourceId]
   * @param {string} [event.correlationId]
   */
  async function processEvent(event) {
    const { eventType } = event;

    const def = eventRegistry.get(eventType);
    if (!def) {
      logger.debug({ eventType }, 'No notification registered for event type');
      return { skipped: true, reason: 'event_type_not_registered' };
    }

    // Persist the event for traceability
    const persistedEvent = await db.tx(async (tx) => {
      return queries.insertNotificationEvent(tx, {
        eventType,
        schemaVersion: 'v1',
        payload: event.payload,
        actorId: event.actorId || null,
        workspaceId: event.workspaceId || null,
        resourceType: event.resourceType || null,
        resourceId: event.resourceId || null,
        correlationId: event.correlationId || null,
      });
    });

    // Resolve recipients from the event
    const recipients = resolveRecipients(event, def);
    if (recipients.length === 0) {
      logger.debug({ eventType, eventId: persistedEvent.id }, 'No recipients for event');
      return { skipped: true, reason: 'no_recipients' };
    }

    // Determine the effective priority
    const priority = priorityService.determine({
      eventType,
      category: def.category,
      defaultPriority: def.defaultPriority,
      context: extractContext(event),
    });

    const notifications = [];

    for (const recipient of recipients) {
      try {
        const notification = await processRecipient({
          event,
          persistedEvent,
          def,
          recipient,
          priority,
        });
        if (notification) notifications.push(notification);
      } catch (err) {
        logger.error(
          { err, eventType, userId: recipient.userId },
          'Notification creation failed for recipient'
        );
      }
    }

    return {
      eventId: persistedEvent.id,
      recipients: recipients.length,
      notificationsCreated: notifications.length,
    };
  }

  function resolveRecipients(event, def) {
    const recipients = [];
    const payload = event.payload || {};

    // Explicit userId in the payload takes precedence
    if (payload.userId) {
      recipients.push({ userId: payload.userId });
    }
    if (payload.userIds && Array.isArray(payload.userIds)) {
      for (const userId of payload.userIds) {
        if (!recipients.some((r) => r.userId === userId)) {
          recipients.push({ userId });
        }
      }
    }
    // Actor (the person who caused the event) if it's a self-notification
    if (
      event.actorId &&
      event.eventType !== 'community.follow_request_accepted' &&
      !recipients.some((r) => r.userId === event.actorId)
    ) {
      recipients.push({ userId: event.actorId });
    }
    // Post author for comment events
    if (event.eventType === 'community.comment_posted' && payload.postAuthorId) {
      if (!recipients.some((r) => r.userId === payload.postAuthorId)) {
        recipients.push({ userId: payload.postAuthorId });
      }
    }
    if (
      ['community.follow_created', 'community.follow_request_created'].includes(event.eventType) &&
      payload.followeeId &&
      !recipients.some((recipient) => recipient.userId === payload.followeeId)
    ) {
      recipients.push({ userId: payload.followeeId });
    }
    if (
      event.eventType === 'community.follow_request_accepted' &&
      payload.followerId &&
      !recipients.some((recipient) => recipient.userId === payload.followerId)
    ) {
      recipients.push({ userId: payload.followerId });
    }

    return recipients;
  }

  function extractContext(event) {
    const payload = event.payload || {};
    const context = {};
    if (payload.amountMinor !== undefined) {
      if (Number(payload.amountMinor) > 100000000) context.magnitude = 'large';
    }
    return context;
  }

  async function processRecipient({
    event,
    persistedEvent,
    def,
    recipient,
    priority,
  }) {
    const { eventType } = event;
    const { userId } = recipient;

    // Build the deduplication key
    const dedupKey = deduplicationService.buildKey({
      eventType,
      userId,
      workspaceId: event.workspaceId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
    });

    const dedupCheck = await deduplicationService.check({ key: dedupKey });
    if (dedupCheck.duplicate) {
      logger.debug(
        { eventType, userId, existingNotificationId: dedupCheck.existingNotificationId },
        'Duplicate notification suppressed'
      );
      return null;
    }

    // Look up the template
    const templateKey = buildTemplateKey(eventType);
    let rendered;
    try {
      const templateResult = await templateService.getTemplate({ key: templateKey });
      rendered = templateService.render({
        template: templateResult.version,
        data: {
          ...event.payload,
          appUrl: process.env.APP_URL || 'https://syncexc.com',
          time: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.warn(
        { err, eventType, templateKey },
        'Template not found; using fallback'
      );
      rendered = {
        title: `${eventType} notification`,
        body: JSON.stringify(event.payload || {}),
        action: null,
      };
    }

    // Create the notification
    const notification = await notificationService.create({
      userId,
      eventId: persistedEvent.id,
      eventType,
      category: def.category,
      priority,
      title: rendered.title,
      message: rendered.body,
      action: rendered.action,
    });

    // Record the dedup key
    await deduplicationService.record({
      key: dedupKey,
      notificationId: notification.id,
    });

    // Enqueue channel deliveries
    const channels = def.defaultChannels || ['in_app'];
    for (const channel of channels) {
      const permission = await preferencesService.shouldDeliver({
        userId,
        workspaceId: event.workspaceId,
        category: def.category,
        notificationType: eventType,
        channel,
        priority,
      });

      if (!permission.allowed) {
        logger.debug(
          { notificationId: notification.id, channel, reason: permission.reason },
          'Channel delivery suppressed'
        );
        continue;
      }

      await deliveryService.enqueue({
        notificationId: notification.id,
        channel,
      });
    }

    // Record usage
    await usageService.record({
      userId,
      workspaceId: event.workspaceId,
      channel: 'in_app',
    });

    // Broadcast over WebSocket for realtime in-app
    if (events) {
      await events.emitNow('notification.created', {
        notificationId: notification.id,
        userId,
        priority,
        category: def.category,
      });
    }

    return notification;
  }

  function buildTemplateKey(eventType) {
    // Templates use dotted keys that mostly mirror event types.
    // e.g. 'user.password_changed' → 'security.password_changed'
    const map = {
      'user.login_success': 'security.login_success',
      'user.suspicious_login': 'security.login_success',
      'user.password_changed': 'security.password_changed',
      'user.mfa_enabled': 'security.mfa_changed',
      'user.mfa_disabled': 'security.mfa_changed',
      'user.recovery_codes_regenerated': 'security.mfa_changed',
      'user.email_changed': 'security.password_changed',
      'user.session_revoked': 'security.session_revoked',
      'user.trusted_device_added': 'security.login_success',
      'user.restricted': 'security.account_restricted',
      'user.restored': 'security.account_restricted',
      'billing.payment_succeeded': 'billing.payment_succeeded',
      'billing.payment_failed': 'billing.payment_failed',
      'billing.subscription_activated': 'billing.subscription_activated',
      'billing.subscription_expiring': 'billing.subscription_expiring',
      'billing.subscription_canceled': 'billing.subscription_activated',
      'billing.refund_completed': 'billing.refund_completed',
      'execution.order_acknowledged': 'trading.order_filled',
      'execution.order_partially_filled': 'trading.order_filled',
      'execution.order_filled': 'trading.order_filled',
      'execution.order_rejected': 'trading.order_rejected',
      'execution.order_canceled': 'trading.order_filled',
      'execution.outcome_uncertain': 'trading.outcome_uncertain',
      'sync.operation_completed': 'sync.partial',
      'sync.operation_failed': 'sync.operation_failed',
      'sync.reconciliation_required': 'sync.operation_failed',
      'risk.blocked': 'risk.blocked',
      'risk.approval_requested': 'risk.approval_required',
      'risk.circuit_breaker_activated': 'risk.circuit_breaker',
      'risk.emergency_pause_active': 'risk.emergency_pause',
      'source.health_changed': 'sources.health_changed',
      'source.activated': 'sources.health_changed',
      'source.paused': 'sources.health_changed',
      'signal.eligible': 'signals.eligible',
      'signal.review_required': 'signals.review_required',
      'signal.message_received': 'signals.eligible',
      'signal.blocked': 'signals.review_required',
      'automation.run_failed': 'automation.run_failed',
      'automation.approval_required': 'automation.approval_required',
      'automation.run_completed': 'automation.run_failed',
      'automation.run_started': 'automation.run_failed',
      'referral.commission_accrued': 'referral.commission_accrued',
      'referral.payout_processed': 'referral.payout_processed',
      'referral.fraud_case_opened': 'referral.commission_accrued',
      'developer.credential_revoked': 'developer.credential_revoked',
      'developer.webhook_failed': 'developer.webhook_failed',
      'support.ticket_created': 'support.ticket_created',
      'support.ticket_assigned': 'support.ticket_reply',
      'support.ticket_escalated': 'support.ticket_reply',
      'support.ticket_resolved': 'support.ticket_resolved',
      'support.ticket_reopened': 'support.ticket_reply',
      'platform.incident_created': 'platform.incident_created',
      'platform.incident_updated': 'platform.incident_created',
      'platform.incident_resolved': 'platform.incident_resolved',
      'community.post_published': 'community.post_published',
      'community.comment_posted': 'community.comment_posted',
      'community.follow_created': 'community.follow_created',
      'community.follow_request_created': 'community.follow_request_created',
      'community.moderation_action': 'community.moderation_action',
    };
    return map[eventType] || eventType;
  }

  return {
    processEvent,
  };
}

export default createOrchestratorService;
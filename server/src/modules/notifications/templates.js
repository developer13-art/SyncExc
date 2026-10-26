/**
 * SyncExc Server — Template service
 *
 * Templates use a safe `{{ variable }}` syntax. No eval, no arbitrary code.
 * Every variable comes from the event payload.
 */

import { NotFoundError } from '../../lib/errors.js';

const VARIABLE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

export function createTemplateService({ db, queries, logger }) {
  async function registerTemplate({ key, eventType, description, version = 1, locale = 'en', titleTemplate, bodyTemplate, actionTemplate, channels }) {
    return db.tx(async (tx) => {
      let template = await queries.findTemplate(key);
      if (!template) {
        template = await queries.insertTemplate(tx, {
          key,
          eventType,
          description,
        });
      }

      const versionRow = await queries.insertTemplateVersion(tx, {
        templateId: template.id,
        version,
        locale,
        titleTemplate,
        bodyTemplate,
        actionTemplate,
        channels,
      });

      return versionRow;
    });
  }

  async function getTemplate({ key, locale = 'en' }) {
    const template = await queries.findTemplate(key);
    if (!template) throw new NotFoundError('Template');
    const version = await queries.findLatestTemplateVersion(template.id, locale);
    if (!version) throw new NotFoundError('Template version');
    return { template, version };
  }

  /**
   * Render a template with the given data.
   * Handles missing variables safely — replaces with empty string.
   */
  function render({ template, data }) {
    const title = interpolate(template.title_template, data);
    const body = interpolate(template.body_template, data);
    let action = null;
    if (template.action_template) {
      action = interpolateObject(template.action_template, data);
    }
    return { title, body, action };
  }

  function interpolate(str, data) {
    if (!str) return '';
    return str.replace(VARIABLE_PATTERN, (_, path) => {
      const value = getNestedValue(data, path);
      return value == null ? '' : String(value);
    });
  }

  function interpolateObject(obj, data) {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        out[key] = interpolate(value, data);
      } else if (value && typeof value === 'object') {
        out[key] = interpolateObject(value, data);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function getNestedValue(obj, path) {
    if (!path) return undefined;
    const parts = String(path).split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur == null) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  async function listTemplates() {
    return queries.listTemplates();
  }

  /**
   * Register the platform's default templates. Called at bootstrap.
   */
  async function registerDefaults() {
    const defaults = [
      // Security
      {
        key: 'security.login_success',
        eventType: 'user.login_success',
        description: 'Alert on successful sign-in from a new device',
        version: 1,
        titleTemplate: 'New sign-in to your SyncExc account',
        bodyTemplate: 'We noticed a sign-in to your account at {{ time }} from {{ deviceLabel }} ({{ ipAddress }}). If this was you, no action is needed.',
        actionTemplate: { label: 'Review sessions', url: '{{ appUrl }}/settings/sessions' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'security.password_changed',
        eventType: 'user.password_changed',
        description: 'Alert on password change',
        version: 1,
        titleTemplate: 'Your SyncExc password was changed',
        bodyTemplate: 'Your password was changed at {{ time }}. If you did not make this change, contact support immediately.',
        actionTemplate: { label: 'Review security settings', url: '{{ appUrl }}/settings/security' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'security.mfa_changed',
        eventType: 'user.mfa_disabled',
        description: 'Alert on MFA changes',
        version: 1,
        titleTemplate: 'Multi-factor authentication was changed',
        bodyTemplate: 'Multi-factor authentication was changed on your account at {{ time }}. If you did not do this, secure your account immediately.',
        actionTemplate: { label: 'Review security settings', url: '{{ appUrl }}/settings/security' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'security.session_revoked',
        eventType: 'user.session_revoked',
        description: 'Alert on session revocation',
        version: 1,
        titleTemplate: 'A session was revoked',
        bodyTemplate: 'A session was revoked from your SyncExc account at {{ time }}.',
        actionTemplate: { label: 'Review sessions', url: '{{ appUrl }}/settings/sessions' },
        channels: ['in_app'],
      },
      {
        key: 'security.account_restricted',
        eventType: 'user.restricted',
        description: 'Alert when the account is restricted',
        version: 1,
        titleTemplate: 'Your SyncExc account has been restricted',
        bodyTemplate: 'Your account was restricted at {{ time }}. Reason: {{ reason }}. Contact support if you believe this is in error.',
        actionTemplate: { label: 'Contact support', url: '{{ appUrl }}/support' },
        channels: ['in_app', 'email'],
      },

      // Billing
      {
        key: 'billing.payment_succeeded',
        eventType: 'billing.payment_succeeded',
        description: 'Payment received',
        version: 1,
        titleTemplate: 'Payment received',
        bodyTemplate: 'We received your payment of {{ amount }} {{ currency }} at {{ time }}. Thank you.',
        actionTemplate: { label: 'View invoices', url: '{{ appUrl }}/billing/invoices' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'billing.payment_failed',
        eventType: 'billing.payment_failed',
        description: 'Payment failed',
        version: 1,
        titleTemplate: 'Payment failed',
        bodyTemplate: 'Your recent payment of {{ amount }} {{ currency }} failed at {{ time }}. Please update your payment method.',
        actionTemplate: { label: 'Update payment method', url: '{{ appUrl }}/billing' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'billing.subscription_activated',
        eventType: 'billing.subscription_activated',
        description: 'Subscription activated',
        version: 1,
        titleTemplate: 'Your subscription is active',
        bodyTemplate: 'Your SyncExc subscription is now active. Plan: {{ planName }}. Renews on {{ renewsAt }}.',
        actionTemplate: { label: 'View subscription', url: '{{ appUrl }}/billing' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'billing.subscription_expiring',
        eventType: 'billing.subscription_expiring',
        description: 'Subscription expiring soon',
        version: 1,
        titleTemplate: 'Your subscription is expiring soon',
        bodyTemplate: 'Your SyncExc subscription will expire on {{ expiresAt }}. Renew now to avoid interruption.',
        actionTemplate: { label: 'Renew subscription', url: '{{ appUrl }}/billing' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'billing.refund_completed',
        eventType: 'billing.refund_completed',
        description: 'Refund completed',
        version: 1,
        titleTemplate: 'Refund processed',
        bodyTemplate: 'Your refund of {{ amount }} {{ currency }} was processed at {{ time }}.',
        actionTemplate: { label: 'View payment history', url: '{{ appUrl }}/billing/payments' },
        channels: ['in_app', 'email'],
      },

      // Trading
      {
        key: 'trading.order_filled',
        eventType: 'execution.order_filled',
        description: 'Order filled',
        version: 2,
        titleTemplate: 'Order filled: {{ instrument }}',
        bodyTemplate: 'Your {{ side }} order on {{ instrument }} filled at an average price of {{ averageFillPrice }}.',
        actionTemplate: { label: 'View order', url: '{{ appUrl }}/terminal/orders/{{ orderId }}' },
        channels: ['in_app'],
      },
      {
        key: 'trading.order_acknowledged',
        eventType: 'execution.order_acknowledged',
        description: 'Order accepted by exchange',
        version: 1,
        titleTemplate: 'Order submitted: {{ instrument }}',
        bodyTemplate: 'The exchange accepted your {{ side }} order on {{ instrument }}. This does not mean it has filled yet.',
        actionTemplate: { label: 'Track order', url: '{{ appUrl }}/terminal/orders/{{ orderId }}' },
        channels: ['in_app'],
      },
      {
        key: 'trading.order_partially_filled',
        eventType: 'execution.order_partially_filled',
        description: 'Order partially filled',
        version: 1,
        titleTemplate: 'Order partially filled: {{ instrument }}',
        bodyTemplate: 'Your {{ side }} order on {{ instrument }} has a confirmed partial fill of {{ filledQuantity }} at an average price of {{ averageFillPrice }}.',
        actionTemplate: { label: 'View order', url: '{{ appUrl }}/terminal/orders/{{ orderId }}' },
        channels: ['in_app'],
      },
      {
        key: 'trading.order_canceled',
        eventType: 'execution.order_canceled',
        description: 'Order canceled',
        version: 1,
        titleTemplate: 'Order canceled: {{ instrument }}',
        bodyTemplate: 'Your {{ side }} order on {{ instrument }} was canceled.',
        actionTemplate: { label: 'View order', url: '{{ appUrl }}/terminal/orders/{{ orderId }}' },
        channels: ['in_app'],
      },
      {
        key: 'trading.order_rejected',
        eventType: 'execution.order_rejected',
        description: 'Order rejected',
        version: 1,
        titleTemplate: 'Order rejected: {{ instrument }}',
        bodyTemplate: 'Your {{ side }} order on {{ instrument }} was rejected. Reason: {{ reason }}.',
        actionTemplate: { label: 'View order', url: '{{ appUrl }}/terminal/orders/{{ orderId }}' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'trading.outcome_uncertain',
        eventType: 'execution.outcome_uncertain',
        description: 'Execution outcome is uncertain',
        version: 1,
        titleTemplate: 'Order outcome needs verification',
        bodyTemplate: 'The order for {{ instrument }} did not return a conclusive outcome. Please check reconciliation before acting.',
        actionTemplate: { label: 'Open reconciliation', url: '{{ appUrl }}/terminal/executions/{{ orderId }}' },
        channels: ['in_app', 'email'],
      },

      // Sync
      {
        key: 'sync.operation_failed',
        eventType: 'sync.operation_failed',
        description: 'Sync operation failed',
        version: 1,
        titleTemplate: 'Synchronization failed',
        bodyTemplate: 'A sync operation for group {{ groupName }} failed at destination {{ destinationName }}. Reason: {{ reason }}.',
        actionTemplate: { label: 'View operation', url: '{{ appUrl }}/synchronization/operations/{{ operationId }}' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'sync.partial',
        eventType: 'sync.operation_completed',
        description: 'Sync partially completed',
        version: 1,
        titleTemplate: 'Synchronization partially completed',
        bodyTemplate: 'The sync operation for {{ instrument }} completed with exceptions. Review each destination before resuming automation.',
        actionTemplate: { label: 'View operation', url: '{{ appUrl }}/synchronization/operations/{{ operationId }}' },
        channels: ['in_app'],
      },

      // Risk
      {
        key: 'risk.blocked',
        eventType: 'risk.blocked',
        description: 'Operation blocked by risk policy',
        version: 1,
        titleTemplate: 'Operation blocked by risk policy',
        bodyTemplate: 'Your {{ operationType }} on {{ instrument }} was blocked by risk rule {{ rule }}. Reason: {{ reason }}.',
        actionTemplate: { label: 'View risk evaluation', url: '{{ appUrl }}/risk/evaluations/{{ evaluationId }}' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'risk.approval_required',
        eventType: 'risk.approval_requested',
        description: 'Approval required for operation',
        version: 1,
        titleTemplate: 'Approval required',
        bodyTemplate: 'An operation on {{ instrument }} requires your approval before proceeding.',
        actionTemplate: { label: 'Review approval', url: '{{ appUrl }}/risk/approvals/{{ approvalId }}' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'risk.circuit_breaker',
        eventType: 'risk.circuit_breaker_activated',
        description: 'Circuit breaker activated',
        version: 1,
        titleTemplate: 'Circuit breaker activated',
        bodyTemplate: 'A circuit breaker was activated at {{ time }}. Trigger: {{ triggerType }}. Reason: {{ reason }}.',
        actionTemplate: { label: 'View incident', url: '{{ appUrl }}/risk/incidents/{{ incidentId }}' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'risk.emergency_pause',
        eventType: 'risk.emergency_pause_active',
        description: 'Emergency pause active',
        version: 1,
        titleTemplate: 'Emergency pause active',
        bodyTemplate: 'An emergency pause is active on scope {{ scope }}. Reason: {{ reason }}. Existing exchange orders may still be active.',
        actionTemplate: { label: 'View pause', url: '{{ appUrl }}/risk/emergency' },
        channels: ['in_app', 'email'],
      },

      // Sources
      {
        key: 'sources.health_changed',
        eventType: 'source.health_changed',
        description: 'Source health changed',
        version: 1,
        titleTemplate: 'Source health changed: {{ sourceName }}',
        bodyTemplate: 'Source {{ sourceName }} changed from {{ previousState }} to {{ newState }} at {{ time }}.',
        actionTemplate: { label: 'View source', url: '{{ appUrl }}/sources/{{ sourceId }}/health' },
        channels: ['in_app'],
      },

      // Signals
      {
        key: 'signals.eligible',
        eventType: 'signal.eligible',
        description: 'Signal eligible for execution',
        version: 1,
        titleTemplate: 'New eligible signal: {{ instrument }}',
        bodyTemplate: 'A new signal for {{ instrument }} ({{ direction }}) is eligible. Entry: {{ entry }}.',
        actionTemplate: { label: 'View signal', url: '{{ appUrl }}/signals/{{ candidateId }}' },
        channels: ['in_app'],
      },
      {
        key: 'signals.review_required',
        eventType: 'signal.review_required',
        description: 'Signal needs review',
        version: 1,
        titleTemplate: 'Signal needs review',
        bodyTemplate: 'A signal for {{ instrument }} requires review before proceeding. Issues: {{ issueCount }}.',
        actionTemplate: { label: 'Review signal', url: '{{ appUrl }}/signals/{{ candidateId }}' },
        channels: ['in_app'],
      },

      // Automation
      {
        key: 'automation.run_failed',
        eventType: 'automation.run_failed',
        description: 'Workflow run failed',
        version: 1,
        titleTemplate: 'Workflow run failed',
        bodyTemplate: 'Your workflow {{ workflowName }} failed at node {{ nodeId }}. Reason: {{ reason }}.',
        actionTemplate: { label: 'View run', url: '{{ appUrl }}/automation/runs/{{ runId }}' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'automation.approval_required',
        eventType: 'automation.approval_required',
        description: 'Workflow requires approval',
        version: 1,
        titleTemplate: 'Workflow approval required',
        bodyTemplate: 'Workflow {{ workflowName }} requires your approval to proceed.',
        actionTemplate: { label: 'Review approval', url: '{{ appUrl }}/automation/runs/{{ runId }}' },
        channels: ['in_app', 'email'],
      },

      // Referral
      {
        key: 'referral.commission_accrued',
        eventType: 'referral.commission_accrued',
        description: 'Commission accrued',
        version: 1,
        titleTemplate: 'Commission accrued',
        bodyTemplate: 'A commission of {{ amount }} {{ currency }} was accrued to your referral wallet.',
        actionTemplate: { label: 'View dashboard', url: '{{ appUrl }}/referral' },
        channels: ['in_app'],
      },
      {
        key: 'referral.payout_processed',
        eventType: 'referral.payout_processed',
        description: 'Payout processed',
        version: 1,
        titleTemplate: 'Payout processed',
        bodyTemplate: 'Your payout of {{ amount }} {{ currency }} was processed at {{ time }}.',
        actionTemplate: { label: 'View payouts', url: '{{ appUrl }}/referral/payouts' },
        channels: ['in_app', 'email'],
      },

      // Developer
      {
        key: 'developer.credential_revoked',
        eventType: 'developer.credential_revoked',
        description: 'API credential revoked',
        version: 1,
        titleTemplate: 'API credential revoked',
        bodyTemplate: 'An API credential for {{ applicationName }} was revoked. Reason: {{ reason }}.',
        actionTemplate: { label: 'View credentials', url: '{{ appUrl }}/developer/applications/{{ applicationId }}/credentials' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'developer.webhook_failed',
        eventType: 'developer.webhook_failed',
        description: 'Webhook delivery failed',
        version: 1,
        titleTemplate: 'Webhook delivery failed',
        bodyTemplate: 'A webhook delivery to {{ destinationUrl }} failed after {{ attempts }} attempts.',
        actionTemplate: { label: 'View delivery', url: '{{ appUrl }}/developer/webhooks/{{ subscriptionId }}/deliveries' },
        channels: ['in_app'],
      },

      // Support
      {
        key: 'support.ticket_created',
        eventType: 'support.ticket_created',
        description: 'Ticket created',
        version: 1,
        titleTemplate: 'Support ticket created',
        bodyTemplate: 'Your support ticket {{ reference }} was created. Subject: {{ subject }}.',
        actionTemplate: { label: 'View ticket', url: '{{ appUrl }}/support/tickets/{{ ticketId }}' },
        channels: ['in_app'],
      },
      {
        key: 'support.ticket_reply',
        eventType: 'support.ticket_assigned',
        description: 'Reply on support ticket',
        version: 1,
        titleTemplate: 'New reply on ticket {{ reference }}',
        bodyTemplate: 'Support replied to your ticket {{ reference }}. Review the reply and continue the conversation.',
        actionTemplate: { label: 'View ticket', url: '{{ appUrl }}/support/tickets/{{ ticketId }}' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'support.ticket_resolved',
        eventType: 'support.ticket_resolved',
        description: 'Ticket resolved',
        version: 1,
        titleTemplate: 'Your support ticket was resolved',
        bodyTemplate: 'Your ticket {{ reference }} was marked resolved. We would appreciate your feedback.',
        actionTemplate: { label: 'Leave feedback', url: '{{ appUrl }}/support/tickets/{{ ticketId }}/feedback' },
        channels: ['in_app'],
      },

      // Platform
      {
        key: 'platform.incident_created',
        eventType: 'platform.incident_created',
        description: 'Platform incident',
        version: 1,
        titleTemplate: 'Platform incident: {{ title }}',
        bodyTemplate: 'A platform incident ({{ severity }}) was reported. Summary: {{ summary }}.',
        actionTemplate: { label: 'View status', url: '{{ appUrl }}/status' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'platform.incident_resolved',
        eventType: 'platform.incident_resolved',
        description: 'Platform incident resolved',
        version: 1,
        titleTemplate: 'Platform incident resolved',
        bodyTemplate: 'The incident "{{ title }}" has been resolved at {{ time }}.',
        actionTemplate: { label: 'View status', url: '{{ appUrl }}/status' },
        channels: ['in_app', 'email'],
      },
      {
        key: 'community.comment_posted',
        eventType: 'community.comment_posted',
        description: 'A user commented on your post',
        titleTemplate: 'New comment on your post',
        bodyTemplate: 'Someone replied to your community post.',
        actionTemplate: { label: 'View post', url: '{{ appUrl }}/app/community/posts/{{ postId }}' },
        channels: ['in_app'],
      },
      {
        key: 'community.follow_created',
        eventType: 'community.follow_created',
        description: 'A user followed your profile',
        titleTemplate: 'You have a new follower',
        bodyTemplate: 'Someone started following your community profile.',
        actionTemplate: { label: 'View profile', url: '{{ appUrl }}/app/community/profile' },
        channels: ['in_app'],
      },
      {
        key: 'community.follow_request_created',
        eventType: 'community.follow_request_created',
        description: 'A user requested to follow your profile',
        titleTemplate: 'New follow request',
        bodyTemplate: 'Someone requested to follow your private community profile.',
        actionTemplate: { label: 'Review requests', url: '{{ appUrl }}/app/community/profile' },
        channels: ['in_app'],
      },
      {
        key: 'community.follow_request_accepted',
        eventType: 'community.follow_request_accepted',
        description: 'Your follow request was accepted',
        titleTemplate: 'Follow request accepted',
        bodyTemplate: 'Your request to follow a community profile was accepted.',
        actionTemplate: { label: 'View community', url: '{{ appUrl }}/app/community/feed' },
        channels: ['in_app'],
      },
      {
        key: 'community.message_request_created',
        eventType: 'community.message_request_created',
        description: 'A user sent you a message request',
        titleTemplate: 'New message request',
        bodyTemplate: 'Someone wants to start a conversation with you.',
        actionTemplate: { label: 'Review request', url: '{{ appUrl }}/app/community/messages' },
        channels: ['in_app'],
      },
      {
        key: 'community.message_request_accepted',
        eventType: 'community.message_request_accepted',
        description: 'Your message request was accepted',
        titleTemplate: 'Message request accepted',
        bodyTemplate: 'Your request was accepted. You can now reply.',
        actionTemplate: {
          label: 'Open conversation',
          url: '{{ appUrl }}/app/community/messages/{{ conversationId }}',
        },
        channels: ['in_app'],
      },
      {
        key: 'community.message_request_rejected',
        eventType: 'community.message_request_rejected',
        description: 'Your message request was declined',
        titleTemplate: 'Message request declined',
        bodyTemplate: 'Your message request was declined.',
        actionTemplate: { label: 'Open messages', url: '{{ appUrl }}/app/community/messages' },
        channels: ['in_app'],
      },
      {
        key: 'community.message_received',
        eventType: 'community.message_received',
        description: 'You received a direct message',
        titleTemplate: 'New community message',
        bodyTemplate: 'You received a new direct message.',
        actionTemplate: {
          label: 'Open conversation',
          url: '{{ appUrl }}/app/community/messages/{{ conversationId }}',
        },
        channels: ['in_app'],
      },
      {
        key: 'community.moderation_action',
        eventType: 'community.moderation_action',
        description: 'A moderation decision affected your content',
        titleTemplate: 'Community moderation update',
        bodyTemplate: 'A moderator applied the action "{{ action }}" to reported content.',
        actionTemplate: { label: 'Open community', url: '{{ appUrl }}/app/community' },
        channels: ['in_app'],
      },
    ];

    for (const def of defaults) {
      await registerTemplate(def);
    }

    logger.info({ count: defaults.length }, 'Default notification templates registered');
  }

  return {
    registerTemplate,
    getTemplate,
    render,
    listTemplates,
    registerDefaults,
  };
}

export default createTemplateService;
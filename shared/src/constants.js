/**
 * SyncExc Shared Constants
 *
 * Every enum, status, and controlled vocabulary used across server, client,
 * and admin. All objects are frozen. All values are strings unless stated.
 */

/* =============================================================================
 * IDENTITY (Module 01)
 * ========================================================================== */

export const USER_STATUS = Object.freeze({
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  TEMPORARILY_RESTRICTED: 'temporarily_restricted',
  SUSPENDED: 'suspended',
  DELETION_PENDING: 'deletion_pending',
  DELETED: 'deleted',
});

export const EMAIL_VERIFICATION_STATUS = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  CHANGE_PENDING: 'change_pending',
});

export const MFA_METHOD = Object.freeze({
  TOTP: 'totp',
});

export const AUTH_METHOD_TYPE = Object.freeze({
  PASSWORD: 'password',
  GOOGLE: 'google',
  GITHUB: 'github',
});

export const SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

export const CHALLENGE_TYPE = Object.freeze({
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  MFA_VERIFICATION: 'mfa_verification',
  EMAIL_CHANGE: 'email_change',
  PHONE_VERIFICATION: 'phone_verification',
});

export const SECURITY_EVENT_TYPE = Object.freeze({
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET: 'password_reset',
  EMAIL_CHANGE: 'email_change',
  EMAIL_VERIFIED: 'email_verified',
  MFA_ENABLED: 'mfa_enabled',
  MFA_DISABLED: 'mfa_disabled',
  MFA_RESET: 'mfa_reset',
  RECOVERY_CODES_REGENERATED: 'recovery_codes_regenerated',
  SESSION_REVOKED: 'session_revoked',
  ALL_SESSIONS_REVOKED: 'all_sessions_revoked',
  TRUSTED_DEVICE_ADDED: 'trusted_device_added',
  TRUSTED_DEVICE_REMOVED: 'trusted_device_removed',
  ACCOUNT_RESTRICTED: 'account_restricted',
  ACCOUNT_RESTORED: 'account_restored',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
});

/* =============================================================================
 * WORKSPACES (Module 03)
 * ========================================================================== */

export const WORKSPACE_TYPE = Object.freeze({
  PERSONAL: 'personal',
  ORGANIZATION: 'organization',
  TRADER: 'trader',
  DEVELOPER: 'developer',
});

export const WORKSPACE_STATUS = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
  SUSPENDED: 'suspended',
  RESTRICTED: 'restricted',
  PENDING_CLOSURE: 'pending_closure',
  ARCHIVED: 'archived',
  CLOSED: 'closed',
});

export const WORKSPACE_MEMBER_STATUS = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REMOVED: 'removed',
  OWNERSHIP_TRANSFER_PENDING: 'ownership_transfer_pending',
});

export const WORKSPACE_ROLE = Object.freeze({
  OWNER: 'owner',
  ADMINISTRATOR: 'administrator',
  TRADING_OPERATOR: 'trading_operator',
  ANALYST: 'analyst',
  VIEWER: 'viewer',
});

export const INVITATION_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

export const PERMISSION = Object.freeze({
  // Workspace
  WORKSPACE_VIEW: 'workspace.view',
  WORKSPACE_UPDATE: 'workspace.update',
  WORKSPACE_DELETE: 'workspace.delete',

  // Members
  MEMBERS_VIEW: 'members.view',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_REMOVE: 'members.remove',
  MEMBERS_ROLE_UPDATE: 'members.role.update',

  // Connections
  CONNECTIONS_VIEW: 'connections.view',
  CONNECTIONS_CREATE: 'connections.create',
  CONNECTIONS_UPDATE: 'connections.update',
  CONNECTIONS_DISCONNECT: 'connections.disconnect',

  // Connection sharing
  CONNECTIONS_SHARE: 'connections.share',
  CONNECTIONS_GRANTS_MANAGE: 'connections.grants.manage',
  CONNECTIONS_GRANTS_REVOKE: 'connections.grants.revoke',

  // Strategies
  STRATEGIES_VIEW: 'strategies.view',
  STRATEGIES_CREATE: 'strategies.create',
  STRATEGIES_UPDATE: 'strategies.update',
  STRATEGIES_ARCHIVE: 'strategies.archive',

  // Synchronization
  SYNC_VIEW: 'sync.view',
  SYNC_CONFIGURE: 'sync.configure',
  SYNC_PAUSE: 'sync.pause',
  SYNC_RESUME: 'sync.resume',

  // Execution
  TRADING_MONITOR: 'trading.monitor',
  TRADING_REQUEST_EXECUTION: 'trading.request_execution',
  TRADING_APPROVE_EXECUTION: 'trading.approve_execution',
  TRADING_MANAGE_AUTOMATION: 'trading.manage_automation',

  // Risk
  RISK_VIEW: 'risk.view',
  RISK_CONFIGURE: 'risk.configure',
  RISK_OVERRIDE: 'risk.override',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Audit
  AUDIT_VIEW: 'audit.view',
  AUDIT_EXPORT: 'audit.export',

  // Billing
  BILLING_VIEW: 'billing.view',
  BILLING_MANAGE: 'billing.manage',
});

export const CONNECTION_SHARE_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

/* =============================================================================
 * SUBSCRIPTION & BILLING (Module 02)
 * ========================================================================== */

export const SUBSCRIPTION_STATUS = Object.freeze({
  PENDING: 'pending',
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  GRACE_PERIOD: 'grace_period',
  CANCEL_SCHEDULED: 'cancel_scheduled',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
});

export const PLAN_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  RETIRED: 'retired',
  ARCHIVED: 'archived',
});

export const BILLING_INTERVAL = Object.freeze({
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  PARTIALLY_REFUNDED: 'partially_refunded',
  REFUNDED: 'refunded',
});

export const PAYMENT_PROVIDER = Object.freeze({
  STRIPE: 'stripe',
  PAYSTACK: 'paystack',
  FLUTTERWAVE: 'flutterwave',
});

export const REFUND_STATUS = Object.freeze({
  REQUESTED: 'requested',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  FAILED: 'failed',
  CANCELED: 'canceled',
});

export const DISPUTE_STATUS = Object.freeze({
  RECEIVED: 'received',
  UNDER_REVIEW: 'under_review',
  WON: 'won',
  LOST: 'lost',
  CLOSED: 'closed',
});

export const INVOICE_STATUS = Object.freeze({
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  VOID: 'void',
  REFUNDED: 'refunded',
});

/* =============================================================================
 * EXCHANGE CONNECTIONS (Module 04)
 * ========================================================================== */

export const EXCHANGE = Object.freeze({
  BINANCE: 'binance',
  BYBIT: 'bybit',
  BITGET: 'bitget',
  OKX: 'okx',
});

export const EXCHANGE_ENVIRONMENT = Object.freeze({
  LIVE: 'live',
  TESTNET: 'testnet',
  DEMO: 'demo',
});

export const EXCHANGE_ENVIRONMENTS = Object.freeze({
  [EXCHANGE.BINANCE]: Object.freeze([
    EXCHANGE_ENVIRONMENT.LIVE,
    EXCHANGE_ENVIRONMENT.TESTNET,
  ]),
  [EXCHANGE.BYBIT]: Object.freeze([
    EXCHANGE_ENVIRONMENT.LIVE,
    EXCHANGE_ENVIRONMENT.DEMO,
    EXCHANGE_ENVIRONMENT.TESTNET,
  ]),
  [EXCHANGE.BITGET]: Object.freeze([
    EXCHANGE_ENVIRONMENT.LIVE,
    EXCHANGE_ENVIRONMENT.DEMO,
  ]),
  [EXCHANGE.OKX]: Object.freeze([
    EXCHANGE_ENVIRONMENT.LIVE,
    EXCHANGE_ENVIRONMENT.DEMO,
  ]),
});

export const CONNECTION_STATUS = Object.freeze({
  PENDING: 'pending',
  VALIDATING: 'validating',
  ACTIVE: 'active',
  DEGRADED: 'degraded',
  REAUTH_REQUIRED: 'reauth_required',
  SUSPENDED: 'suspended',
  DISCONNECTED: 'disconnected',
  REVOKED: 'revoked',
  ERROR: 'error',
});

export const EXCHANGE_INTEGRATION_STATUS = Object.freeze({
  PLANNED: 'planned',
  IN_DEVELOPMENT: 'in_development',
  TESTING: 'testing',
  AVAILABLE: 'available',
  DEGRADED: 'degraded',
  MAINTENANCE: 'maintenance',
  DISABLED: 'disabled',
});

export const ADAPTER_LIFECYCLE_STATE = Object.freeze({
  DEVELOPMENT: 'development',
  VALIDATION: 'validation',
  STAGED: 'staged',
  ACTIVE: 'active',
  RESTRICTED: 'restricted',
  DEPRECATED: 'deprecated',
  RETIRED: 'retired',
});

export const CAPABILITY_VERIFICATION = Object.freeze({
  VERIFIED: 'verified',
  MISSING_PERMISSION: 'missing_permission',
  UNSUPPORTED: 'unsupported',
  UNKNOWN: 'unknown',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',
  REVOKED_OR_INVALID: 'revoked_or_invalid',
});

export const ACCOUNT_TYPE = Object.freeze({
  SPOT: 'spot',
  MARGIN: 'margin',
  USD_M_FUTURES: 'usd_m_futures',
  COIN_M_FUTURES: 'coin_m_futures',
  UNIFIED: 'unified',
  SUBACCOUNT: 'subaccount',
});

export const CONNECTION_HEALTH_STATE = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  STALE: 'stale',
  REAUTH_REQUIRED: 'reauth_required',
  UNAVAILABLE: 'unavailable',
  SUSPENDED: 'suspended',
});

/* =============================================================================
 * TRADING TERMINAL (Module 05)
 * ========================================================================== */

export const MARKET_TYPE = Object.freeze({
  SPOT: 'spot',
  FUTURES: 'futures',
  PERPETUAL: 'perpetual',
});

export const ORDER_SIDE = Object.freeze({
  BUY: 'buy',
  SELL: 'sell',
});

export const ORDER_TYPE = Object.freeze({
  MARKET: 'market',
  LIMIT: 'limit',
  STOP_MARKET: 'stop_market',
  STOP_LIMIT: 'stop_limit',
  TAKE_PROFIT_MARKET: 'take_profit_market',
  TAKE_PROFIT_LIMIT: 'take_profit_limit',
  TRAILING_STOP: 'trailing_stop',
});

export const TIME_IN_FORCE = Object.freeze({
  GTC: 'GTC',
  IOC: 'IOC',
  FOK: 'FOK',
  DAY: 'DAY',
  GTX: 'GTX',
});

export const ORDER_STATUS = Object.freeze({
  PENDING_SUBMISSION: 'pending_submission',
  SUBMITTED: 'submitted',
  ACKNOWLEDGED: 'acknowledged',
  PARTIALLY_FILLED: 'partially_filled',
  FILLED: 'filled',
  CANCEL_REQUESTED: 'cancel_requested',
  CANCELED: 'canceled',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const POSITION_SIDE = Object.freeze({
  LONG: 'long',
  SHORT: 'short',
  BOTH: 'both',
});

export const POSITION_MODE = Object.freeze({
  ONE_WAY: 'one_way',
  HEDGE: 'hedge',
});

export const MARGIN_MODE = Object.freeze({
  ISOLATED: 'isolated',
  CROSS: 'cross',
});

export const EXECUTION_STATE = Object.freeze({
  PENDING: 'pending',
  VALIDATING: 'validating',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  SUBMITTING: 'submitting',
  ACKNOWLEDGED: 'acknowledged',
  PARTIALLY_EXECUTED: 'partially_executed',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
  FAILED: 'failed',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const EXECUTION_MODE = Object.freeze({
  MONITOR_ONLY: 'monitor_only',
  CONFIRM_BEFORE_EXECUTION: 'confirm_before_execution',
  AUTHORIZED_AUTOMATION: 'authorized_automation',
});

/* =============================================================================
 * SYNCHRONIZATION (Module 06)
 * ========================================================================== */

export const SYNC_STATUS = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  COMPLETED_WITH_EXCEPTIONS: 'completed_with_exceptions',
  PARTIALLY_COMPLETED: 'partially_completed',
  FAILED: 'failed',
  OUTCOME_UNKNOWN: 'outcome_unknown',
  PAUSED: 'paused',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const DESTINATION_OUTCOME = Object.freeze({
  PENDING: 'pending',
  DISPATCHED: 'dispatched',
  ACKNOWLEDGED: 'acknowledged',
  PARTIALLY_FILLED: 'partially_filled',
  FILLED: 'filled',
  REJECTED: 'rejected',
  TIMED_OUT: 'timed_out',
  RATE_LIMITED: 'rate_limited',
  DISCONNECTED: 'disconnected',
  RISK_BLOCKED: 'risk_blocked',
  UNSUPPORTED: 'unsupported',
  OUTCOME_UNKNOWN: 'outcome_unknown',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const SYNC_EVENT_TYPE = Object.freeze({
  ORDER_ACCEPTED: 'order_accepted',
  ORDER_FILLED: 'order_filled',
  ORDER_PARTIALLY_FILLED: 'order_partially_filled',
  ORDER_CANCELED: 'order_canceled',
  ORDER_REJECTED: 'order_rejected',
  ORDER_AMENDED: 'order_amended',
  POSITION_CHANGED: 'position_changed',
});

export const SIZING_POLICY_TYPE = Object.freeze({
  FIXED_QUANTITY: 'fixed_quantity',
  FIXED_QUOTE_VALUE: 'fixed_quote_value',
  PROPORTIONAL_SOURCE_QUANTITY: 'proportional_source_quantity',
  BALANCE_BASED_SCALING: 'balance_based_scaling',
  RISK_LIMITED_SIZING: 'risk_limited_sizing',
  CAPPED_PROPORTIONAL: 'capped_proportional',
});

export const MIRRORING_MODE = Object.freeze({
  ORDER_INTENT: 'order_intent',
  FILL_BASED: 'fill_based',
  LIFECYCLE_SYNC: 'lifecycle_sync',
});

/* =============================================================================
 * RISK MANAGEMENT (Module 07)
 * ========================================================================== */

export const RISK_POLICY_SCOPE = Object.freeze({
  PLATFORM: 'platform',
  WORKSPACE: 'workspace',
  SYNC_GROUP: 'sync_group',
  EXCHANGE_ACCOUNT: 'exchange_account',
  INSTRUMENT: 'instrument',
  OPERATION: 'operation',
});

export const RISK_POLICY_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
});

export const RISK_ENFORCEMENT_MODE = Object.freeze({
  BLOCK: 'block',
  REQUIRE_CONFIRMATION: 'require_confirmation',
  REQUIRE_ADDITIONAL_APPROVAL: 'require_additional_approval',
  WARN: 'warn',
  MONITOR_ONLY: 'monitor_only',
});

export const RISK_DECISION_OUTCOME = Object.freeze({
  APPROVED: 'approved',
  BLOCKED: 'blocked',
  CONFIRMATION_REQUIRED: 'confirmation_required',
  APPROVAL_REQUIRED: 'approval_required',
  DATA_UNAVAILABLE: 'data_unavailable',
  REVALIDATION_REQUIRED: 'revalidation_required',
  MONITORING_ONLY: 'monitoring_only',
});

export const RISK_SEVERITY = Object.freeze({
  INFORMATIONAL: 'informational',
  WARNING: 'warning',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const CIRCUIT_BREAKER_TRIGGER = Object.freeze({
  ORDER_LIMIT_BREACH: 'order_limit_breach',
  EXPOSURE_LIMIT_BREACH: 'exposure_limit_breach',
  DUPLICATE_OPERATIONS: 'duplicate_operations',
  UNRESOLVED_OUTCOMES: 'unresolved_outcomes',
  EXCHANGE_DATA_STALE: 'exchange_data_stale',
  RECONCILIATION_DIVERGENCE: 'reconciliation_divergence',
  ADAPTER_FAILURES: 'adapter_failures',
  EXECUTION_ERRORS_VOLUME: 'execution_errors_volume',
  SECURITY_INCIDENT: 'security_incident',
});

export const INCIDENT_CATEGORY = Object.freeze({
  RISK_LIMIT_VIOLATION: 'risk_limit_violation',
  UNAUTHORIZED_ORDER: 'unauthorized_order',
  DUPLICATE_EXECUTION: 'duplicate_execution',
  UNKNOWN_SUBMISSION_OUTCOME: 'unknown_submission_outcome',
  POSITION_DISCREPANCY: 'position_discrepancy',
  EXCHANGE_CONNECTIVITY_FAILURE: 'exchange_connectivity_failure',
  MARGIN_WARNING: 'margin_warning',
  STALE_MARKET_DATA: 'stale_market_data',
  POLICY_CONFIGURATION_ERROR: 'policy_configuration_error',
  APPROVAL_FAILURE: 'approval_failure',
  CIRCUIT_BREAKER_ACTIVATION: 'circuit_breaker_activation',
  RECONCILIATION_FAILURE: 'reconciliation_failure',
  SECURITY_EXECUTION_RESTRICTION: 'security_execution_restriction',
});

export const INCIDENT_STATUS = Object.freeze({
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  CONTAINED: 'contained',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

export const EMERGENCY_PAUSE_SCOPE = Object.freeze({
  WORKSPACE: 'workspace',
  SYNC_GROUP: 'sync_group',
  DESTINATION_ACCOUNT: 'destination_account',
  EXCHANGE_ADAPTER: 'exchange_adapter',
  INSTRUMENT: 'instrument',
  PLATFORM_WIDE: 'platform_wide',
});

export const EMERGENCY_PAUSE_STATUS = Object.freeze({
  REQUESTED: 'requested',
  PROPAGATING: 'propagating',
  ACTIVE: 'active',
  RESUMING: 'resuming',
  RESUMED: 'resumed',
});

/* =============================================================================
 * SIGNAL SOURCES (Module 08)
 * ========================================================================== */

export const SOURCE_TYPE = Object.freeze({
  TELEGRAM: 'telegram',
  DISCORD: 'discord',
  WHATSAPP: 'whatsapp',
  WEBHOOK: 'webhook',
  WEBSITE: 'website',
  REST_API: 'rest_api',
  EMAIL: 'email',
});

export const SOURCE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_VALIDATION: 'pending_validation',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  ACTIVE: 'active',
  PAUSED: 'paused',
  RESTRICTED: 'restricted',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
  REJECTED: 'rejected',
});

export const SOURCE_REVIEW_STATE = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  APPROVED_FOR_VALIDATION: 'approved_for_validation',
  VALIDATION_IN_PROGRESS: 'validation_in_progress',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ADDITIONAL_INFORMATION_REQUIRED: 'additional_information_required',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
});

export const SOURCE_HEALTH_STATE = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  STALE: 'stale',
  DISCONNECTED: 'disconnected',
  AUTHORIZATION_REQUIRED: 'authorization_required',
  RATE_LIMITED: 'rate_limited',
  VALIDATION_REQUIRED: 'validation_required',
  DISABLED: 'disabled',
});

export const SOURCE_QUALITY_STATE = Object.freeze({
  INSUFFICIENT_DATA: 'insufficient_data',
  UNDER_OBSERVATION: 'under_observation',
  ESTABLISHED: 'established',
  DEGRADED: 'degraded',
});

export const DISCOVERY_JOB_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled',
});

export const METADATA_PROVENANCE = Object.freeze({
  USER_PROVIDED: 'user_provided',
  PROVIDER_REPORTED: 'provider_reported',
  SYSTEM_OBSERVED: 'system_observed',
  AI_INFERRED: 'ai_inferred',
  ADMIN_VERIFIED: 'admin_verified',
});

/* =============================================================================
 * SIGNAL INTELLIGENCE (Module 09)
 * ========================================================================== */

export const SIGNAL_CLASSIFICATION = Object.freeze({
  NEW_TRADE: 'new_trade',
  TRADE_MANAGEMENT: 'trade_management',
  MARKET_ANALYSIS: 'market_analysis',
  NEWS: 'news',
  EDUCATION: 'education',
  ADVERTISEMENT: 'advertisement',
  CONVERSATION: 'conversation',
  UNKNOWN: 'unknown',
});

export const SIGNAL_STATUS = Object.freeze({
  RECEIVED: 'received',
  DEDUPLICATED: 'deduplicated',
  PROCESSING: 'processing',
  REVIEW_REQUIRED: 'review_required',
  VALIDATING: 'validating',
  ELIGIBLE: 'eligible',
  BLOCKED: 'blocked',
  EXPIRED: 'expired',
  CANCELED: 'canceled',
  REJECTED: 'rejected',
  FAILED: 'failed',
});

export const SIGNAL_ISSUE_TYPE = Object.freeze({
  MISSING_FIELD: 'missing_field',
  AMBIGUOUS_VALUE: 'ambiguous_value',
  CONTRADICTORY_VALUE: 'contradictory_value',
  STALE_INFORMATION: 'stale_information',
  EXPIRED_SIGNAL: 'expired_signal',
  CANCELED_SIGNAL: 'canceled_signal',
  INVALID_VALUE: 'invalid_value',
});

export const SIGNAL_ISSUE_SEVERITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const CONFIDENCE_LEVEL = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNRESOLVED: 'unresolved',
});

export const ELIGIBILITY_OUTCOME = Object.freeze({
  ELIGIBLE_FOR_HANDOFF: 'eligible_for_handoff',
  REVIEW_REQUIRED: 'review_required',
  BLOCKED_INVALID: 'blocked_invalid',
  BLOCKED_STATE: 'blocked_state',
  BLOCKED_CANCELED: 'blocked_canceled',
  BLOCKED_SOURCE: 'blocked_source',
  BLOCKED_DUPLICATE: 'blocked_duplicate',
  WAITING_FOR_DATA: 'waiting_for_data',
  WAITING_FOR_AUTHORIZATION: 'waiting_for_authorization',
});

export const UPDATE_EVENT_TYPE = Object.freeze({
  NEW_SIGNAL: 'new_signal',
  ENTRY_CLARIFICATION: 'entry_clarification',
  ENTRY_MODIFICATION: 'entry_modification',
  STOP_LOSS_MODIFICATION: 'stop_loss_modification',
  TARGET_ADDITION: 'target_addition',
  TARGET_REMOVAL: 'target_removal',
  TARGET_MODIFICATION: 'target_modification',
  LEVERAGE_CLARIFICATION: 'leverage_clarification',
  SIGNAL_CANCELATION: 'signal_cancelation',
  SIGNAL_EXPIRATION: 'signal_expiration',
  POSITION_CLOSURE: 'position_closure',
  GENERAL_COMMENTARY: 'general_commentary',
  UNRECOGNIZED_UPDATE: 'unrecognized_update',
});

export const SIGNAL_DIRECTION = Object.freeze({
  LONG: 'long',
  SHORT: 'short',
});

/* =============================================================================
 * MARKETPLACE (Module 10)
 * ========================================================================== */

export const PROVIDER_ACCOUNT_TYPE = Object.freeze({
  INDIVIDUAL: 'individual',
  ORGANIZATION: 'organization',
  PLATFORM_MANAGED: 'platform_managed',
  RESTRICTED: 'restricted',
});

export const PROVIDER_MODERATION_STATE = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  ADDITIONAL_INFORMATION_REQUIRED: 'additional_information_required',
  RESTRICTED: 'restricted',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
  APPEAL_PENDING: 'appeal_pending',
});

export const MARKETPLACE_SUBSCRIPTION_STATUS = Object.freeze({
  FOLLOWING: 'following',
  SUBSCRIPTION_PENDING: 'subscription_pending',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
  ACCESS_REVOKED: 'access_revoked',
});

export const COPY_CONFIG_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_VALIDATION: 'pending_validation',
  ACTIVE: 'active',
  PAUSED: 'paused',
  REVOKED: 'revoked',
  NEEDS_ATTENTION: 'needs_attention',
});

export const COPY_PROCESSING_OUTCOME = Object.freeze({
  PENDING: 'pending',
  ELIGIBLE: 'eligible',
  HELD: 'held',
  SKIPPED: 'skipped',
  EXECUTED: 'executed',
  FAILED: 'failed',
});

export const COPY_SKIP_REASON = Object.freeze({
  COPYING_DISABLED: 'copying_disabled',
  SUBSCRIPTION_UNAVAILABLE: 'subscription_unavailable',
  SIGNAL_WITHDRAWN: 'signal_withdrawn',
  SIGNAL_EXPIRED: 'signal_expired',
  INSTRUMENT_UNSUPPORTED: 'instrument_unsupported',
  PROTECTION_UNSUPPORTED: 'protection_unsupported',
  ORDER_TYPE_UNSUPPORTED: 'order_type_unsupported',
  DESTINATION_DISCONNECTED: 'destination_disconnected',
  MISSING_FIELDS: 'missing_fields',
  INVALID_ALLOCATION: 'invalid_allocation',
  RISK_LIMIT_EXCEEDED: 'risk_limit_exceeded',
  CONFIRMATION_REQUIRED: 'confirmation_required',
  DUPLICATE_INTENT: 'duplicate_intent',
  RATE_LIMITED: 'rate_limited',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const PERFORMANCE_METHODOLOGY_VERSION = Object.freeze({
  V1: 'v1',
  V2: 'v2',
});

/* =============================================================================
 * AUTOMATION (Module 11)
 * ========================================================================== */

export const WORKFLOW_STATUS = Object.freeze({
  DRAFT: 'draft',
  VALIDATED: 'validated',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  PAUSED: 'paused',
  RETIRED: 'retired',
  VALIDATION_FAILED: 'validation_failed',
  NEEDS_ATTENTION: 'needs_attention',
});

export const WORKFLOW_RUN_STATE = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  WAITING: 'waiting',
  AWAITING_APPROVAL: 'awaiting_approval',
  SUCCEEDED: 'succeeded',
  PARTIALLY_SUCCEEDED: 'partially_succeeded',
  FAILED: 'failed',
  CANCELED: 'canceled',
  TIMED_OUT: 'timed_out',
  PAUSED: 'paused',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const NODE_CATEGORY = Object.freeze({
  TRIGGER: 'trigger',
  CONDITION: 'condition',
  DATA: 'data',
  FLOW: 'flow',
  APPROVAL: 'approval',
  ACTION: 'action',
  INTEGRATION: 'integration',
  UTILITY: 'utility',
});

export const TRIGGER_TYPE = Object.freeze({
  SIGNAL_PUBLISHED: 'signal_published',
  SIGNAL_VALIDATED: 'signal_validated',
  SOURCE_STATUS_CHANGED: 'source_status_changed',
  EXCHANGE_CONNECTION_EVENT: 'exchange_connection_event',
  SYNC_OPERATION_EVENT: 'sync_operation_event',
  RISK_EVENT: 'risk_event',
  CIRCUIT_BREAKER_ACTIVATED: 'circuit_breaker_activated',
  WORKSPACE_PAUSE_EVENT: 'workspace_pause_event',
  SCHEDULED: 'scheduled',
  WEBHOOK: 'webhook',
  EXTERNAL_INTEGRATION: 'external_integration',
});

export const SCHEDULE_TYPE = Object.freeze({
  ONE_TIME: 'one_time',
  RECURRING: 'recurring',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  CALENDAR: 'calendar',
});

/* =============================================================================
 * SIMULATION (Module 12)
 * ========================================================================== */

export const SIMULATION_ENVIRONMENT_TYPE = Object.freeze({
  PAPER_TRADING: 'paper_trading',
  HISTORICAL_BACKTEST: 'historical_backtest',
  MARKET_REPLAY: 'market_replay',
  WORKFLOW_TEST: 'workflow_test',
  SYNCHRONIZATION_TEST: 'synchronization_test',
  SCENARIO_TEST: 'scenario_test',
});

export const SIMULATION_RUN_STATE = Object.freeze({
  QUEUED: 'queued',
  VALIDATING: 'validating',
  PREPARING_DATA: 'preparing_data',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  COMPLETED_WITH_WARNINGS: 'completed_with_warnings',
  FAILED: 'failed',
  CANCELED: 'canceled',
  TIMED_OUT: 'timed_out',
});

export const SIMULATION_ENVIRONMENT_STATE = Object.freeze({
  DRAFT: 'draft',
  READY: 'ready',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled',
  ARCHIVED: 'archived',
});

export const FILL_MODEL = Object.freeze({
  IMMEDIATE_SIMPLIFIED: 'immediate_simplified',
  TRADE_BASED: 'trade_based',
  ORDER_BOOK_BASED: 'order_book_based',
  PARTIAL_FILL: 'partial_fill',
  LATENCY_AWARE: 'latency_aware',
  FAILURE_INJECTION: 'failure_injection',
});

/* =============================================================================
 * REFERRAL (Module 13)
 * ========================================================================== */

export const AFFILIATE_STATUS = Object.freeze({
  NOT_ENROLLED: 'not_enrolled',
  APPLICATION_PENDING: 'application_pending',
  ACTIVE: 'active',
  RESTRICTED: 'restricted',
  SUSPENDED: 'suspended',
  TERMINATED: 'terminated',
});

export const COMMISSION_STATE = Object.freeze({
  ACCUMULATED: 'accumulated',
  APPROVED: 'approved',
  HELD: 'held',
  RELEASED: 'released',
  ADJUSTED: 'adjusted',
  REVERSED: 'reversed',
});

export const COMMISSION_TYPE = Object.freeze({
  FIRST_PAYMENT: 'first_payment',
  RECURRING: 'recurring',
});

export const PAYOUT_STATUS = Object.freeze({
  REQUESTED: 'requested',
  VALIDATING: 'validating',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
  RETURNED: 'returned',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const PAYOUT_PROVIDER = Object.freeze({
  STRIPE_CONNECT: 'stripe_connect',
  PAYSTACK_TRANSFER: 'paystack_transfer',
});

export const FRAUD_CASE_STATE = Object.freeze({
  DETECTED: 'detected',
  UNDER_REVIEW: 'under_review',
  ADDITIONAL_INFORMATION_REQUIRED: 'additional_information_required',
  CLEARED: 'cleared',
  CONFIRMED_ABUSE: 'confirmed_abuse',
  RESTRICTED: 'restricted',
  APPEALED: 'appealed',
  CLOSED: 'closed',
});

export const LINK_STATUS = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

/* =============================================================================
 * DEVELOPER PLATFORM (Module 14)
 * ========================================================================== */

export const APPLICATION_STATE = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  RESTRICTED: 'restricted',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
  ARCHIVED: 'archived',
});

export const CREDENTIAL_STATE = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  ROTATION_PENDING: 'rotation_pending',
  REVOKED: 'revoked',
  COMPROMISED: 'compromised',
});

export const WEBHOOK_DELIVERY_STATE = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  DELIVERING: 'delivering',
  DELIVERED: 'delivered',
  RETRY_SCHEDULED: 'retry_scheduled',
  FAILED: 'failed',
  DEAD_LETTERED: 'dead_lettered',
  SUSPENDED: 'suspended',
});

export const OAUTH_GRANT_STATE = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

export const API_SCOPE = Object.freeze({
  PROFILE_READ: 'profile:read',
  WORKSPACE_READ: 'workspace:read',
  EXCHANGE_ACCOUNTS_READ: 'exchange_accounts:read',
  BALANCES_READ: 'balances:read',
  MARKETS_READ: 'markets:read',
  ORDERS_READ: 'orders:read',
  ORDERS_WRITE: 'orders:write',
  POSITIONS_READ: 'positions:read',
  POSITIONS_WRITE: 'positions:write',
  TRADES_READ: 'trades:read',
  SYNC_READ: 'sync:read',
  SYNC_WRITE: 'sync:write',
  SIGNALS_READ: 'signals:read',
  AUTOMATION_READ: 'automation:read',
  AUTOMATION_WRITE: 'automation:write',
  SIMULATION_READ: 'simulation:read',
  SIMULATION_WRITE: 'simulation:write',
  WEBHOOKS_MANAGE: 'webhooks:manage',
  NOTIFICATIONS_READ: 'notifications:read',
});

/* =============================================================================
 * COMMUNITY (Module 15)
 * ========================================================================== */

export const COMMUNITY_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  FOLLOWERS: 'followers',
  GROUP_MEMBERS: 'group_members',
  WORKSPACE_MEMBERS: 'workspace_members',
  PRIVATE: 'private',
});

export const GROUP_TYPE = Object.freeze({
  PUBLIC: 'public',
  PRIVATE: 'private',
  APPROVAL_BASED: 'approval_based',
  ORGANIZATION: 'organization',
});

export const GROUP_MEMBER_STATE = Object.freeze({
  INVITED: 'invited',
  REQUESTED: 'requested',
  ACTIVE: 'active',
  MUTED: 'muted',
  RESTRICTED: 'restricted',
  LEFT: 'left',
  REMOVED: 'removed',
  BANNED: 'banned',
});

export const GROUP_ROLE = Object.freeze({
  OWNER: 'owner',
  ADMINISTRATOR: 'administrator',
  MODERATOR: 'moderator',
  MEMBER: 'member',
  READ_ONLY: 'read_only',
});

export const MODERATION_STATE = Object.freeze({
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  ESCALATED: 'escalated',
});

export const RECOMMENDATION_TYPE = Object.freeze({
  PEOPLE: 'people',
  GROUPS: 'groups',
  DISCUSSIONS: 'discussions',
  COMMUNITIES: 'communities',
});

/* =============================================================================
 * NOTIFICATIONS (Module 16)
 * ========================================================================== */

export const NOTIFICATION_CHANNEL = Object.freeze({
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
});

export const NOTIFICATION_PRIORITY = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const NOTIFICATION_STATUS = Object.freeze({
  CREATED: 'created',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  DELIVERED: 'delivered',
  READ: 'read',
  ARCHIVED: 'archived',
  EXPIRED: 'expired',
  CANCELED: 'canceled',
  FAILED: 'failed',
});

export const DELIVERY_ATTEMPT_STATE = Object.freeze({
  PENDING: 'pending',
  SENDING: 'sending',
  ACCEPTED: 'accepted',
  DELIVERED: 'delivered',
  RETRY_SCHEDULED: 'retry_scheduled',
  FAILED: 'failed',
  SUPPRESSED: 'suppressed',
  EXPIRED: 'expired',
  DEAD_LETTERED: 'dead_lettered',
});

export const NOTIFICATION_EVENT_TYPE = Object.freeze({
  // Account security
  LOGIN_SUCCESS: 'login_success',
  SUSPICIOUS_LOGIN: 'suspicious_login',
  PASSWORD_CHANGED: 'password_changed',
  MFA_CHANGED: 'mfa_changed',
  RECOVERY_CODES_REGENERATED: 'recovery_codes_regenerated',
  EMAIL_CHANGED: 'email_changed',
  SESSION_REVOKED: 'session_revoked',
  DEVICE_ADDED: 'device_added',
  ACCOUNT_RESTRICTED: 'account_restricted',
  // Billing
  PAYMENT_SUCCESSFUL: 'payment_successful',
  PAYMENT_FAILED: 'payment_failed',
  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  SUBSCRIPTION_EXPIRING: 'subscription_expiring',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  REFUND_PROCESSED: 'refund_processed',
  // Trading
  ORDER_ACCEPTED: 'order_accepted',
  ORDER_PARTIALLY_FILLED: 'order_partially_filled',
  ORDER_FILLED: 'order_filled',
  ORDER_REJECTED: 'order_rejected',
  ORDER_CANCELLED: 'order_cancelled',
  EXECUTION_UNCERTAIN: 'execution_uncertain',
  // Sync
  SYNC_STARTED: 'sync_started',
  SYNC_PARTIAL: 'sync_partial',
  SYNC_FAILED: 'sync_failed',
  SYNC_RECONCILED: 'sync_reconciled',
  // Risk
  RISK_BLOCKED: 'risk_blocked',
  RISK_APPROVAL_REQUIRED: 'risk_approval_required',
  EMERGENCY_PAUSE: 'emergency_pause',
  CIRCUIT_BREAKER: 'circuit_breaker',
  // Sources
  SOURCE_OUTAGE: 'source_outage',
  SOURCE_RECOVERED: 'source_recovered',
  SOURCE_STALE: 'source_stale',
  // Signals
  SIGNAL_RECEIVED: 'signal_received',
  SIGNAL_UPDATED: 'signal_updated',
  SIGNAL_INCOMPLETE: 'signal_incomplete',
  // Automation
  WORKFLOW_FAILED: 'workflow_failed',
  WORKFLOW_APPROVAL_NEEDED: 'workflow_approval_needed',
  // Referral
  REFERRAL_CREDITED: 'referral_credited',
  PAYOUT_PROCESSED: 'payout_processed',
  // Developer
  WEBHOOK_FAILED: 'webhook_failed',
  API_CREDENTIAL_ROTATED: 'api_credential_rotated',
  // Support
  SUPPORT_REPLY: 'support_reply',
  SUPPORT_ESCALATION: 'support_escalation',
  // Community
  COMMUNITY_MENTION: 'community_mention',
  COMMUNITY_REPLY: 'community_reply',
  MODERATION_DECISION: 'moderation_decision',
  // System
  SYSTEM_NOTICE: 'system_notice',
});

/* =============================================================================
 * SUPPORT (Module 17)
 * ========================================================================== */

export const TICKET_STATUS = Object.freeze({
  NEW: 'new',
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  WAITING_FOR_CUSTOMER: 'waiting_for_customer',
  WAITING_FOR_INTERNAL_TEAM: 'waiting_for_internal_team',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REOPENED: 'reopened',
  CANCELED: 'canceled',
});

export const TICKET_PRIORITY = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
});

export const TICKET_CATEGORY = Object.freeze({
  ACCOUNT_ACCESS: 'account_access',
  BILLING_SUBSCRIPTION: 'billing_subscription',
  EXCHANGE_CONNECTIONS: 'exchange_connections',
  ORDERS_EXECUTION: 'orders_execution',
  TRADE_SYNCHRONIZATION: 'trade_synchronization',
  RISK_SAFETY: 'risk_safety',
  SIGNALS_SOURCES: 'signals_sources',
  AUTOMATION_WORKFLOWS: 'automation_workflows',
  DEVELOPER_API: 'developer_api',
  COMMUNITY_COLLABORATION: 'community_collaboration',
  BUG_FEATURE: 'bug_feature',
  OTHER: 'other',
});

export const ESCALATION_CATEGORY = Object.freeze({
  TECHNICAL: 'technical',
  EXECUTION_INTEGRITY: 'execution_integrity',
  RISK_SAFETY: 'risk_safety',
  SECURITY: 'security',
  BILLING: 'billing',
  DEVELOPER_INTEGRATION: 'developer_integration',
  PLATFORM_INCIDENT: 'platform_incident',
});

export const ARTICLE_STATE = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  PUBLISHED: 'published',
  NEEDS_UPDATE: 'needs_update',
  ARCHIVED: 'archived',
});

export const ATTACHMENT_SCAN_STATE = Object.freeze({
  PENDING: 'pending',
  SCANNING: 'scanning',
  CLEAN: 'clean',
  INFECTED: 'infected',
  FAILED: 'failed',
});

/* =============================================================================
 * ADMIN (Module 18)
 * ========================================================================== */

export const ADMIN_ROLE = Object.freeze({
  PLATFORM_OPERATIONS: 'platform_operations',
  USER_SUPPORT_ADMINISTRATOR: 'user_support_administrator',
  WORKSPACE_ADMINISTRATOR: 'workspace_administrator',
  BILLING_ADMINISTRATOR: 'billing_administrator',
  FINANCIAL_APPROVER: 'financial_approver',
  EXCHANGE_INTEGRATION_OPERATOR: 'exchange_integration_operator',
  SOURCE_REVIEWER: 'source_reviewer',
  REFERRAL_ADMINISTRATOR: 'referral_administrator',
  SUPPORT_OPERATIONS_MANAGER: 'support_operations_manager',
  FEATURE_RELEASE_MANAGER: 'feature_release_manager',
  SECURITY_ADMINISTRATOR: 'security_administrator',
  AUDIT_REVIEWER: 'audit_reviewer',
  PLATFORM_ADMINISTRATOR: 'platform_administrator',
});

export const APPROVAL_STATE = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELED: 'canceled',
});

export const AUDIT_OUTCOME = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  DENIED: 'denied',
  PARTIAL: 'partial',
});

export const FEATURE_FLAG_TYPE = Object.freeze({
  RELEASE: 'release',
  OPERATIONAL_CONTROL: 'operational_control',
  EXPERIMENT: 'experiment',
  EMERGENCY_KILL_SWITCH: 'emergency_kill_switch',
});

export const FEATURE_FLAG_EVAL_REASON = Object.freeze({
  DEFAULT: 'default',
  TARGETING_RULE: 'targeting_rule',
  USER_ALLOWLIST: 'user_allowlist',
  WORKSPACE_ALLOWLIST: 'workspace_allowlist',
  PERCENTAGE_ROLLOUT: 'percentage_rollout',
  REGION: 'region',
  ENTITLEMENT: 'entitlement',
  ADAPTER_VERSION: 'adapter_version',
  KILL_SWITCH: 'kill_switch',
});

export const OPERATION_JOB_STATE = Object.freeze({
  QUEUED: 'queued',
  VALIDATING: 'validating',
  RUNNING: 'running',
  WAITING_FOR_APPROVAL: 'waiting_for_approval',
  PARTIALLY_SUCCEEDED: 'partially_succeeded',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLATION_REQUESTED: 'cancellation_requested',
  CANCELED: 'canceled',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const ALERT_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const ALERT_LIFECYCLE_STATE = Object.freeze({
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
});

/* =============================================================================
 * PLATFORM INCIDENTS
 * ========================================================================== */

export const PLATFORM_INCIDENT_SEVERITY = Object.freeze({
  SEV1: 'sev1',
  SEV2: 'sev2',
  SEV3: 'sev3',
  SEV4: 'sev4',
});

export const PLATFORM_INCIDENT_STATUS = Object.freeze({
  INVESTIGATING: 'investigating',
  IDENTIFIED: 'identified',
  MONITORING: 'monitoring',
  RESOLVED: 'resolved',
});

/* =============================================================================
 * JOBS
 * ========================================================================== */

export const JOB_TYPE = Object.freeze({
  OUTBOX_PUBLISH: 'outbox_publish',
  NOTIFICATION_EMAIL: 'notification_email',
  NOTIFICATION_PUSH: 'notification_push',
  NOTIFICATION_INAPP: 'notification_inapp',
  WEBHOOK_DELIVERY: 'webhook_delivery',
  SYNC_DISPATCH: 'sync_dispatch',
  SYNC_RECONCILE: 'sync_reconcile',
  RISK_MONITOR: 'risk_monitor',
  SIGNAL_INGEST: 'signal_ingest',
  SIGNAL_PARSE: 'signal_parse',
  SIGNAL_VALIDATE: 'signal_validate',
  SOURCE_DISCOVERY: 'source_discovery',
  SOURCE_HEALTH: 'source_health',
  SOURCE_QUALITY: 'source_quality',
  WORKFLOW_EXECUTE: 'workflow_execute',
  WORKFLOW_SCHEDULE: 'workflow_schedule',
  SIMULATION_RUN: 'simulation_run',
  BILLING_RENEWAL: 'billing_renewal',
  BILLING_RECONCILE: 'billing_reconcile',
  BILLING_WEBHOOK: 'billing_webhook',
  REFERRAL_COMMISSION: 'referral_commission',
  REFERRAL_PAYOUT: 'referral_payout',
  REFERRAL_FRAUD: 'referral_fraud',
  AUDIT_WRITER: 'audit_writer',
  SEARCH_INDEXER: 'search_indexer',
  EXPORT_GENERATOR: 'export_generator',
  CLEANUP: 'cleanup',
});

export const JOB_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRY_SCHEDULED: 'retry_scheduled',
  DEAD_LETTERED: 'dead_lettered',
  CANCELED: 'canceled',
});

/* =============================================================================
 * EVENTS
 * ========================================================================== */

export const EVENT_TYPE = Object.freeze({
  // Identity
  USER_REGISTERED: 'user.registered',
  USER_EMAIL_VERIFIED: 'user.email_verified',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_MFA_ENABLED: 'user.mfa_enabled',
  USER_MFA_DISABLED: 'user.mfa_disabled',
  USER_SESSION_CREATED: 'user.session_created',
  USER_SESSION_REVOKED: 'user.session_revoked',
  USER_RESTRICTED: 'user.restricted',
  USER_RESTORED: 'user.restored',

  // Workspaces
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_MEMBER_ADDED: 'workspace.member_added',
  WORKSPACE_MEMBER_REMOVED: 'workspace.member_removed',
  WORKSPACE_INVITATION_SENT: 'workspace.invitation_sent',
  WORKSPACE_INVITATION_ACCEPTED: 'workspace.invitation_accepted',
  WORKSPACE_OWNERSHIP_TRANSFERRED: 'workspace.ownership_transferred',
  CONNECTION_SHARE_GRANTED: 'workspace.connection_share_granted',
  CONNECTION_SHARE_REVOKED: 'workspace.connection_share_revoked',

  // Billing
  SUBSCRIPTION_CREATED: 'billing.subscription_created',
  SUBSCRIPTION_ACTIVATED: 'billing.subscription_activated',
  SUBSCRIPTION_RENEWED: 'billing.subscription_renewed',
  SUBSCRIPTION_CANCELED: 'billing.subscription_canceled',
  SUBSCRIPTION_EXPIRED: 'billing.subscription_expired',
  PAYMENT_SUCCEEDED: 'billing.payment_succeeded',
  PAYMENT_FAILED: 'billing.payment_failed',
  REFUND_COMPLETED: 'billing.refund_completed',
  ENTITLEMENT_GRANTED: 'billing.entitlement_granted',
  ENTITLEMENT_REVOKED: 'billing.entitlement_revoked',

  // Connections
  CONNECTION_CREATED: 'connection.created',
  CONNECTION_VALIDATED: 'connection.validated',
  CONNECTION_ACTIVATED: 'connection.activated',
  CONNECTION_DEGRADED: 'connection.degraded',
  CONNECTION_REAUTH_REQUIRED: 'connection.reauth_required',
  CONNECTION_DISCONNECTED: 'connection.disconnected',
  CREDENTIAL_ROTATED: 'connection.credential_rotated',

  // Terminal / Execution
  ORDER_SUBMITTED: 'execution.order_submitted',
  ORDER_ACKNOWLEDGED: 'execution.order_acknowledged',
  ORDER_PARTIALLY_FILLED: 'execution.order_partially_filled',
  ORDER_FILLED: 'execution.order_filled',
  CLOSED_TRADE_RECORDED: 'execution.closed_trade_recorded',
  ORDER_REJECTED: 'execution.order_rejected',
  ORDER_CANCELED: 'execution.order_canceled',
  EXECUTION_OUTCOME_UNCERTAIN: 'execution.outcome_uncertain',

  // Synchronization
  SYNC_OPERATION_CREATED: 'sync.operation_created',
  SYNC_OPERATION_DISPATCHED: 'sync.operation_dispatched',
  SYNC_OPERATION_COMPLETED: 'sync.operation_completed',
  SYNC_OPERATION_FAILED: 'sync.operation_failed',
  SYNC_RECONCILIATION_REQUIRED: 'sync.reconciliation_required',
  SYNC_RECONCILIATION_COMPLETED: 'sync.reconciliation_completed',
  SYNC_GROUP_PAUSED: 'sync.group_paused',
  SYNC_GROUP_RESUMED: 'sync.group_resumed',

  // Risk
  RISK_EVALUATED: 'risk.evaluated',
  RISK_BLOCKED: 'risk.blocked',
  RISK_APPROVAL_REQUESTED: 'risk.approval_requested',
  RISK_APPROVAL_GRANTED: 'risk.approval_granted',
  RISK_APPROVAL_REJECTED: 'risk.approval_rejected',
  CIRCUIT_BREAKER_ACTIVATED: 'risk.circuit_breaker_activated',
  EMERGENCY_PAUSE_REQUESTED: 'risk.emergency_pause_requested',
  EMERGENCY_PAUSE_ACTIVE: 'risk.emergency_pause_active',
  EMERGENCY_PAUSE_RESUMED: 'risk.emergency_pause_resumed',
  INCIDENT_CREATED: 'risk.incident_created',
  INCIDENT_RESOLVED: 'risk.incident_resolved',

  // Sources
  SOURCE_REGISTERED: 'source.registered',
  SOURCE_APPROVED: 'source.approved',
  SOURCE_REJECTED: 'source.rejected',
  SOURCE_ACTIVATED: 'source.activated',
  SOURCE_PAUSED: 'source.paused',
  SOURCE_HEALTH_CHANGED: 'source.health_changed',
  SOURCE_VALIDATION_COMPLETED: 'source.validation_completed',
  SOURCE_DISCOVERY_COMPLETED: 'source.discovery_completed',

  // Signals
  SIGNAL_MESSAGE_RECEIVED: 'signal.message_received',
  SIGNAL_CANDIDATE_CREATED: 'signal.candidate_created',
  SIGNAL_VALIDATED: 'signal.validated',
  SIGNAL_ELIGIBLE: 'signal.eligible',
  SIGNAL_BLOCKED: 'signal.blocked',
  SIGNAL_REVIEW_REQUIRED: 'signal.review_required',
  SIGNAL_INTENT_CREATED: 'signal.intent_created',
  SIGNAL_INTENT_CANCELED: 'signal.intent_canceled',

  // Marketplace
  PROVIDER_CREATED: 'marketplace.provider_created',
  PROVIDER_APPROVED: 'marketplace.provider_approved',
  PROVIDER_SUSPENDED: 'marketplace.provider_suspended',
  PROVIDER_SIGNAL_PUBLISHED: 'marketplace.signal_published',
  PROVIDER_SIGNAL_UPDATED: 'marketplace.signal_updated',
  FOLLOW_CREATED: 'marketplace.follow_created',
  SUBSCRIPTION_STARTED: 'marketplace.subscription_started',
  COPY_CONFIG_ACTIVATED: 'marketplace.copy_config_activated',
  COPY_CONFIG_REVOKED: 'marketplace.copy_config_revoked',
  COPY_SIGNAL_PROCESSED: 'marketplace.copy_signal_processed',

  // Automation
  WORKFLOW_CREATED: 'automation.workflow_created',
  WORKFLOW_PUBLISHED: 'automation.workflow_published',
  WORKFLOW_ACTIVATED: 'automation.workflow_activated',
  WORKFLOW_PAUSED: 'automation.workflow_paused',
  WORKFLOW_RUN_STARTED: 'automation.run_started',
  WORKFLOW_RUN_COMPLETED: 'automation.run_completed',
  WORKFLOW_RUN_FAILED: 'automation.run_failed',
  WORKFLOW_APPROVAL_REQUIRED: 'automation.approval_required',

  // Simulation
  SIMULATION_RUN_STARTED: 'simulation.run_started',
  SIMULATION_RUN_COMPLETED: 'simulation.run_completed',
  SIMULATION_RUN_FAILED: 'simulation.run_failed',

  // Referral
  REFERRAL_ATTRIBUTED: 'referral.attributed',
  COMMISSION_ACCRUED: 'referral.commission_accrued',
  COMMISSION_REVERSED: 'referral.commission_reversed',
  PAYOUT_REQUESTED: 'referral.payout_requested',
  PAYOUT_PROCESSED: 'referral.payout_processed',
  FRAUD_CASE_OPENED: 'referral.fraud_case_opened',

  // Developer
  APPLICATION_CREATED: 'developer.application_created',
  CREDENTIAL_CREATED: 'developer.credential_created',
  CREDENTIAL_REVOKED: 'developer.credential_revoked',
  WEBHOOK_SUBSCRIBED: 'developer.webhook_subscribed',
  WEBHOOK_DELIVERED: 'developer.webhook_delivered',
  WEBHOOK_FAILED: 'developer.webhook_failed',

  // Community
  POST_PUBLISHED: 'community.post_published',
  COMMENT_POSTED: 'community.comment_posted',
  GROUP_CREATED: 'community.group_created',
  MEMBER_JOINED_GROUP: 'community.member_joined_group',
  REPORT_SUBMITTED: 'community.report_submitted',
  MODERATION_ACTION: 'community.moderation_action',

  // Notifications
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_DELIVERED: 'notification.delivered',
  NOTIFICATION_FAILED: 'notification.failed',

  // Support
  TICKET_CREATED: 'support.ticket_created',
  TICKET_ASSIGNED: 'support.ticket_assigned',
  TICKET_ESCALATED: 'support.ticket_escalated',
  TICKET_RESOLVED: 'support.ticket_resolved',
  TICKET_REOPENED: 'support.ticket_reopened',

  // Admin
  FEATURE_FLAG_CHANGED: 'admin.feature_flag_changed',
  ADMIN_ROLE_CHANGED: 'admin.role_changed',
  ADMIN_APPROVAL_REQUESTED: 'admin.approval_requested',
  ADMIN_APPROVAL_GRANTED: 'admin.approval_granted',
  ADMIN_APPROVAL_REJECTED: 'admin.approval_rejected',
  ADMIN_ACTION_EXECUTED: 'admin.action_executed',

  // Platform incidents
  PLATFORM_INCIDENT_CREATED: 'platform.incident_created',
  PLATFORM_INCIDENT_UPDATED: 'platform.incident_updated',
  PLATFORM_INCIDENT_RESOLVED: 'platform.incident_resolved',
});

/* =============================================================================
 * EXPORTS MAP
 * ========================================================================== */

export const CONSTANTS = Object.freeze({
  USER_STATUS,
  EMAIL_VERIFICATION_STATUS,
  MFA_METHOD,
  AUTH_METHOD_TYPE,
  SESSION_STATUS,
  CHALLENGE_TYPE,
  SECURITY_EVENT_TYPE,
  WORKSPACE_TYPE,
  WORKSPACE_STATUS,
  WORKSPACE_MEMBER_STATUS,
  WORKSPACE_ROLE,
  INVITATION_STATUS,
  PERMISSION,
  CONNECTION_SHARE_STATUS,
  SUBSCRIPTION_STATUS,
  PLAN_STATUS,
  BILLING_INTERVAL,
  PAYMENT_STATUS,
  PAYMENT_PROVIDER,
  REFUND_STATUS,
  DISPUTE_STATUS,
  INVOICE_STATUS,
  EXCHANGE,
  EXCHANGE_ENVIRONMENT,
  EXCHANGE_ENVIRONMENTS,
  CONNECTION_STATUS,
  EXCHANGE_INTEGRATION_STATUS,
  ADAPTER_LIFECYCLE_STATE,
  CAPABILITY_VERIFICATION,
  ACCOUNT_TYPE,
  CONNECTION_HEALTH_STATE,
  MARKET_TYPE,
  ORDER_SIDE,
  ORDER_TYPE,
  TIME_IN_FORCE,
  ORDER_STATUS,
  POSITION_SIDE,
  POSITION_MODE,
  MARGIN_MODE,
  EXECUTION_STATE,
  EXECUTION_MODE,
  SYNC_STATUS,
  DESTINATION_OUTCOME,
  SYNC_EVENT_TYPE,
  SIZING_POLICY_TYPE,
  MIRRORING_MODE,
  RISK_POLICY_SCOPE,
  RISK_POLICY_STATUS,
  RISK_ENFORCEMENT_MODE,
  RISK_DECISION_OUTCOME,
  RISK_SEVERITY,
  CIRCUIT_BREAKER_TRIGGER,
  INCIDENT_CATEGORY,
  INCIDENT_STATUS,
  EMERGENCY_PAUSE_SCOPE,
  EMERGENCY_PAUSE_STATUS,
  SOURCE_TYPE,
  SOURCE_STATUS,
  SOURCE_REVIEW_STATE,
  SOURCE_HEALTH_STATE,
  SOURCE_QUALITY_STATE,
  DISCOVERY_JOB_STATUS,
  METADATA_PROVENANCE,
  SIGNAL_CLASSIFICATION,
  SIGNAL_STATUS,
  SIGNAL_ISSUE_TYPE,
  SIGNAL_ISSUE_SEVERITY,
  CONFIDENCE_LEVEL,
  ELIGIBILITY_OUTCOME,
  UPDATE_EVENT_TYPE,
  SIGNAL_DIRECTION,
  PROVIDER_ACCOUNT_TYPE,
  PROVIDER_MODERATION_STATE,
  MARKETPLACE_SUBSCRIPTION_STATUS,
  COPY_CONFIG_STATUS,
  COPY_PROCESSING_OUTCOME,
  COPY_SKIP_REASON,
  PERFORMANCE_METHODOLOGY_VERSION,
  WORKFLOW_STATUS,
  WORKFLOW_RUN_STATE,
  NODE_CATEGORY,
  TRIGGER_TYPE,
  SCHEDULE_TYPE,
  SIMULATION_ENVIRONMENT_TYPE,
  SIMULATION_RUN_STATE,
  SIMULATION_ENVIRONMENT_STATE,
  FILL_MODEL,
  AFFILIATE_STATUS,
  COMMISSION_STATE,
  COMMISSION_TYPE,
  PAYOUT_STATUS,
  PAYOUT_PROVIDER,
  FRAUD_CASE_STATE,
  LINK_STATUS,
  APPLICATION_STATE,
  CREDENTIAL_STATE,
  WEBHOOK_DELIVERY_STATE,
  OAUTH_GRANT_STATE,
  API_SCOPE,
  COMMUNITY_VISIBILITY,
  GROUP_TYPE,
  GROUP_MEMBER_STATE,
  GROUP_ROLE,
  MODERATION_STATE,
  RECOMMENDATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
  DELIVERY_ATTEMPT_STATE,
  NOTIFICATION_EVENT_TYPE,
  TICKET_STATUS,
  TICKET_PRIORITY,
  TICKET_CATEGORY,
  ESCALATION_CATEGORY,
  ARTICLE_STATE,
  ATTACHMENT_SCAN_STATE,
  ADMIN_ROLE,
  APPROVAL_STATE,
  AUDIT_OUTCOME,
  FEATURE_FLAG_TYPE,
  FEATURE_FLAG_EVAL_REASON,
  OPERATION_JOB_STATE,
  ALERT_SEVERITY,
  ALERT_LIFECYCLE_STATE,
  PLATFORM_INCIDENT_SEVERITY,
  PLATFORM_INCIDENT_STATUS,
  JOB_TYPE,
  JOB_STATUS,
  EVENT_TYPE,
});
export const APP = Object.freeze({
  NAME: 'SyncExc Admin',
  DESCRIPTION: 'Administrator Console for SyncExc',
  DOMAIN: 'syncexc.com',
  VERSION: '1.0.0',
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE_SIZE: 25,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100, 250],
  MAX_PAGE_SIZE: 500,
});

export const TIMEOUTS = Object.freeze({
  API_REQUEST_MS: 30_000,
  UPLOAD_REQUEST_MS: 120_000,
  TOAST_DURATION_MS: 5_000,
  TOAST_ERROR_DURATION_MS: 8_000,
  DEBOUNCE_SEARCH_MS: 300,
  STEP_UP_VALIDITY_MS: 5 * 60_000,
});

export const ADMIN_ROLES = Object.freeze({
  PLATFORM_ADMIN: 'platform_admin',
  PLATFORM_OPERATIONS: 'platform_operations',
  USER_SUPPORT_ADMIN: 'user_support_admin',
  WORKSPACE_ADMIN: 'workspace_admin',
  BILLING_ADMIN: 'billing_admin',
  FINANCIAL_APPROVER: 'financial_approver',
  EXCHANGE_INTEGRATION_OPERATOR: 'exchange_integration_operator',
  SOURCE_REVIEWER: 'source_reviewer',
  REFERRAL_ADMIN: 'referral_admin',
  SUPPORT_OPERATIONS_MANAGER: 'support_operations_manager',
  FEATURE_RELEASE_MANAGER: 'feature_release_manager',
  SECURITY_ADMIN: 'security_admin',
  AUDIT_REVIEWER: 'audit_reviewer',
});

export const ADMIN_ROLE_LABELS = Object.freeze({
  platform_admin: 'Platform administrator',
  platform_operations: 'Platform operations',
  user_support_admin: 'User support administrator',
  workspace_admin: 'Workspace administrator',
  billing_admin: 'Billing administrator',
  financial_approver: 'Financial approver',
  exchange_integration_operator: 'Exchange integration operator',
  source_reviewer: 'Source reviewer',
  referral_admin: 'Referral administrator',
  support_operations_manager: 'Support operations manager',
  feature_release_manager: 'Feature release manager',
  security_admin: 'Security administrator',
  audit_reviewer: 'Audit reviewer',
});

export const APPROVAL_STATES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

export const FEATURE_FLAG_TYPES = Object.freeze({
  RELEASE: 'release',
  OPERATIONAL_CONTROL: 'operational_control',
  EXPERIMENT: 'experiment',
  EMERGENCY_KILL_SWITCH: 'emergency_kill_switch',
});

export const OPERATION_JOB_STATES = Object.freeze({
  QUEUED: 'queued',
  VALIDATING: 'validating',
  RUNNING: 'running',
  WAITING_FOR_APPROVAL: 'waiting_for_approval',
  PARTIALLY_SUCCEEDED: 'partially_succeeded',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLATION_REQUESTED: 'cancellation_requested',
  CANCELLED: 'cancelled',
  RECONCILIATION_REQUIRED: 'reconciliation_required',
});

export const STALE_THRESHOLD_SECONDS = Object.freeze({
  DASHBOARD_METRIC: 60,
  CONNECTION_HEALTH: 60,
  EXCHANGE_HEALTH: 60,
  SOURCE_HEALTH: 300,
  OPERATION_JOB: 30,
});
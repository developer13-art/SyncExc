export const APP = Object.freeze({
  NAME: 'SyncExc',
  DESCRIPTION: 'Multi-exchange cryptocurrency trading synchronization and automation platform',
  DOMAIN: 'syncexc.com',
  URL: 'https://syncexc.com',
  SUPPORT_EMAIL: 'support@syncexc.com',
  SECURITY_EMAIL: 'security@syncexc.com',
  VERSION: '1.0.0',
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 200,
});

export const TIMEOUTS = Object.freeze({
  API_REQUEST_MS: 30_000,
  UPLOAD_REQUEST_MS: 120_000,
  TOAST_DURATION_MS: 5_000,
  TOAST_ERROR_DURATION_MS: 8_000,
  DEBOUNCE_SEARCH_MS: 300,
  WEBSOCKET_RECONNECT_BASE_MS: 1_000,
  WEBSOCKET_RECONNECT_MAX_MS: 30_000,
  WEBSOCKET_HEARTBEAT_MS: 30_000,
});

export const EXECUTION_MODES = Object.freeze({
  MONITOR_ONLY: 'monitor_only',
  CONFIRM_BEFORE_EXECUTION: 'confirm_before_execution',
  AUTHORIZED_AUTOMATION: 'authorized_automation',
});

export const EXECUTION_MODE_LABELS = Object.freeze({
  monitor_only: 'Monitor Only',
  confirm_before_execution: 'Confirm Before Execution',
  authorized_automation: 'Authorized Automation',
});

export const EXECUTION_MODE_DESCRIPTIONS = Object.freeze({
  monitor_only: 'Observe activity and view proposed actions without submitting orders.',
  confirm_before_execution:
    'Prepare eligible operations and require your approval before dispatch.',
  authorized_automation: 'Automatically dispatch eligible operations under active risk controls.',
});

export const STALE_THRESHOLD_SECONDS = Object.freeze({
  BALANCE: 30,
  POSITION: 30,
  ORDER: 15,
  MARKET_DATA: 10,
  CONNECTION_HEALTH: 60,
  SOURCE_HEALTH: 300,
});
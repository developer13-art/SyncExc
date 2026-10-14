export { default as api, axiosInstance } from './client.js';

export {
  ApiError,
  NetworkError,
  TimeoutError,
  CanceledError,
  parseAxiosError,
  isApiError,
  isRetriableError,
  isAuthenticationError,
  isAuthorizationError,
  isValidationError,
  isNotFoundError,
  isConflictError,
  isRateLimitError,
  getErrorMessage,
  getFieldErrors,
} from './errors.js';

export { identityApi } from './identity.api.js';
export { workspacesApi } from './workspaces.api.js';
export { billingApi } from './billing.api.js';
export { connectionsApi } from './connections.api.js';
export { terminalApi } from './terminal.api.js';
export { synchronizationApi } from './synchronization.api.js';
export { riskApi } from './risk.api.js';
export { sourcesApi } from './sources.api.js';
export { signalsApi } from './signals.api.js';
export { marketplaceApi } from './marketplace.api.js';
export { automationApi } from './automation.api.js';
export { simulationApi } from './simulation.api.js';
export { referralApi } from './referral.api.js';
export { developerApi } from './developer.api.js';
export { communityApi } from './community.api.js';
export { notificationsApi } from './notifications.api.js';
export { supportApi } from './support.api.js';
export { adminApi } from './admin.api.js';
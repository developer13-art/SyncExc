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

export { adminAuthApi } from './adminAuth.api.js';
export { adminApi } from './admin.api.js';
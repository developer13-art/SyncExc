import axios from 'axios';

export class ApiError extends Error {
  constructor({ message, code, status, details, correlationId, retriable, cause }) {
    super(message);
    this.name = 'ApiError';
    this.code = code ?? 'UNKNOWN_ERROR';
    this.status = status ?? 0;
    this.details = details ?? null;
    this.correlationId = correlationId ?? null;
    this.retriable = retriable ?? false;
    this.cause = cause ?? null;
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network error. Please check your connection.') {
    super({ message, code: 'NETWORK_ERROR', status: 0, retriable: true });
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(message = 'Request timed out. Please try again.') {
    super({ message, code: 'REQUEST_TIMEOUT', status: 0, retriable: true });
    this.name = 'TimeoutError';
  }
}

export class CanceledError extends ApiError {
  constructor(message = 'Request was canceled.') {
    super({ message, code: 'REQUEST_CANCELED', status: 0, retriable: false });
    this.name = 'CanceledError';
  }
}

const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);
const NON_RETRIABLE_CODES = new Set([
  'VALIDATION_FAILED',
  'PERMISSION_DENIED',
  'AUTHENTICATION_REQUIRED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'ADMIN_PERMISSION_DENIED',
  'ADMIN_APPROVAL_REQUIRED',
  'ADMIN_APPROVAL_EXPIRED',
  'RESOURCE_SCOPE_VIOLATION',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_CONFLICT',
  'OPERATION_ALREADY_IN_PROGRESS',
  'AUDIT_PERSISTENCE_FAILURE',
  'RESOURCE_STATE_CONFLICT',
  'NOT_FOUND',
]);

function extractServerError(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const error = data.error ?? data;
  return {
    message: error.message ?? null,
    code: error.code ?? null,
    details: error.details ?? error.errors ?? null,
    correlationId: error.correlationId ?? data.correlationId ?? null,
  };
}

function statusFallbackMessage(status) {
  const map = {
    400: 'The request was invalid. Please check your input.',
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'This operation conflicts with the current state. Please refresh and try again.',
    422: 'The request could not be processed. Please check your input.',
    429: 'Too many requests. Please wait a moment before trying again.',
    500: 'An unexpected server error occurred. Please try again.',
    502: 'The server is temporarily unavailable.',
    503: 'The service is temporarily unavailable.',
    504: 'The server took too long to respond.',
  };
  return map[status] ?? 'An unexpected error occurred.';
}

export function parseAxiosError(error) {
  if (axios.isCancel(error)) {
    return new CanceledError();
  }

  if (error.code === 'ECONNABORTED' && error.message?.includes('timeout')) {
    return new TimeoutError();
  }

  if (!error.response) {
    if (error.code === 'ERR_NETWORK') {
      return new NetworkError();
    }
    return new ApiError({
      message: error.message ?? 'Unknown error',
      code: error.code ?? 'UNKNOWN_ERROR',
      retriable: true,
      cause: error,
    });
  }

  const { status, data, headers } = error.response;
  const serverError = extractServerError(data);
  const message = serverError?.message ?? data?.message ?? statusFallbackMessage(status);
  const code = serverError?.code ?? `HTTP_${status}`;
  const correlationId = serverError?.correlationId ?? headers?.['x-correlation-id'] ?? null;

  const retriable = RETRIABLE_STATUS.has(status) && !NON_RETRIABLE_CODES.has(code);

  return new ApiError({
    message,
    code,
    status,
    details: serverError?.details ?? null,
    correlationId,
    retriable,
    cause: error,
  });
}

export function isApiError(error, status) {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (status === undefined) {
    return true;
  }
  return error.status === status;
}

export function isRetriableError(error) {
  if (error instanceof CanceledError) {
    return false;
  }
  if (error instanceof ApiError) {
    return error.retriable;
  }
  return axios.isAxiosError(error) && RETRIABLE_STATUS.has(error.response?.status ?? 0);
}

export function isAuthenticationError(error) {
  return error instanceof ApiError && error.status === 401;
}

export function isAuthorizationError(error) {
  return error instanceof ApiError && error.status === 403;
}

export function isValidationError(error) {
  return error instanceof ApiError && error.status === 422;
}

export function isNotFoundError(error) {
  return error instanceof ApiError && error.status === 404;
}

export function isConflictError(error) {
  return error instanceof ApiError && error.status === 409;
}

export function isRateLimitError(error) {
  return error instanceof ApiError && error.status === 429;
}

export function getErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred.';
}

export function getFieldErrors(error) {
  if (!(error instanceof ApiError) || !error.details) {
    return {};
  }
  if (Array.isArray(error.details)) {
    return error.details.reduce((acc, item) => {
      if (item?.field) {
        acc[item.field] = item.message ?? 'Invalid value';
      }
      return acc;
    }, {});
  }
  if (typeof error.details === 'object') {
    return error.details;
  }
  return {};
}

export { ApiError as AdminApiError, isApiError as isAdminApiError };
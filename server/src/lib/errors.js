/**
 * SyncExc Server — Error Hierarchy
 *
 * Errors carry:
 *   - a stable machine-readable code
 *   - an HTTP status
 *   - an optional `details` object safe for clients
 *
 * Errors never carry secrets or internal stack traces to clients.
 */

export class AppError extends Error {
  constructor(message, { code, status = 500, details, cause, expose = false } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || 'INTERNAL_ERROR';
    this.status = status;
    this.details = details;
    this.expose = expose;
    if (cause) this.cause = cause;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.expose ? this.message : 'Internal server error',
      ...(this.expose && this.details ? { details: this.details } : {}),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, { code: 'VALIDATION_ERROR', status: 422, details, expose: true });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', code = 'AUTHENTICATION_REQUIRED') {
    super(message, { code, status: 401, expose: true });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(message, { code, status: 403, expose: true });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, { code: 'NOT_FOUND', status: 404, expose: true });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, { code, status: 409, expose: true });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfterSeconds) {
    super(message, {
      code: 'RATE_LIMITED',
      status: 429,
      expose: true,
      details: retryAfterSeconds ? { retryAfterSeconds } : undefined,
    });
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor(message = 'Subscription required', feature) {
    super(message, {
      code: 'SUBSCRIPTION_REQUIRED',
      status: 402,
      expose: true,
      details: feature ? { feature } : undefined,
    });
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = 'Quota exceeded', details) {
    super(message, { code: 'QUOTA_EXCEEDED', status: 402, expose: true, details });
  }
}

export class ExternalProviderError extends AppError {
  constructor(message, { provider, retryable = false, status = 502, details } = {}) {
    super(message, {
      code: 'EXTERNAL_PROVIDER_ERROR',
      status,
      expose: true,
      details: { provider, retryable, ...(details || {}) },
    });
  }
}

export class FeatureDisabledError extends AppError {
  constructor(feature) {
    super(`Feature '${feature}' is disabled`, {
      code: 'FEATURE_DISABLED',
      status: 404,
      expose: true,
      details: { feature },
    });
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = 'Idempotency conflict') {
    super(message, { code: 'IDEMPOTENCY_CONFLICT', status: 409, expose: true });
  }
}

export class UnsupportedOperationError extends AppError {
  constructor(message = 'Operation not supported') {
    super(message, { code: 'UNSUPPORTED_OPERATION', status: 400, expose: true });
  }
}

export const Errors = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  SubscriptionRequiredError,
  QuotaExceededError,
  ExternalProviderError,
  FeatureDisabledError,
  IdempotencyConflictError,
  UnsupportedOperationError,
};
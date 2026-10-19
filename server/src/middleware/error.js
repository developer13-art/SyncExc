/**
 * SyncExc Server — Error middleware
 *
 * 1. 404 handler for unmatched routes.
 * 2. Final error handler that maps every thrown value to a consistent
 *    response shape.
 *
 * Error responses never leak internal details. Stack traces are logged
 * server-side but never sent to clients.
 */

import config from '../config.js';
import { AppError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';
import { redactSensitive } from '../lib/mask.js';

const logger = createLogger({ component: 'error' });

/* =============================================================================
 * 404
 * ========================================================================== */

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
    },
    meta: {
      requestId: req.id,
      timestamp: new Date().toISOString(),
    },
  });
}

/* =============================================================================
 * ERROR NORMALIZATION
 * ========================================================================== */

function normalizeError(err) {
  // Known application errors
  if (err instanceof AppError) {
    return {
      status: err.status || 500,
      code: err.code,
      message: err.expose ? err.message : 'An error occurred',
      details: err.expose ? err.details : undefined,
    };
  }

  // Joi validation errors (defensive — validation middleware should catch these)
  if (err.isJoi || err.name === 'ValidationError') {
    return {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: {
        fields: (err.details || []).map((d) => ({
          path: d.path.join('.'),
          message: d.message,
        })),
      },
    };
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    if (err.constraint === 'exchange_connections_label_unique') {
      return {
        status: 409,
        code: 'CONNECTION_LABEL_CONFLICT',
        message: 'A connection with this label already exists in this workspace. Choose another label.',
        details: { constraint: err.constraint },
      };
    }
    return {
      status: 409,
      code: 'CONFLICT',
      message: 'A resource with these values already exists',
      details: { constraint: err.constraint },
    };
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return {
      status: 409,
      code: 'REFERENCE_VIOLATION',
      message: 'Referenced resource does not exist',
      details: { constraint: err.constraint },
    };
  }

  // PostgreSQL check constraint
  if (err.code === '23514') {
    return {
      status: 422,
      code: 'CONSTRAINT_VIOLATION',
      message: 'Value violates a database constraint',
      details: { constraint: err.constraint },
    };
  }

  // Timeout
  if (err.name === 'TimeoutError' || err.code === 'ETIMEDOUT') {
    return {
      status: 504,
      code: 'TIMEOUT',
      message: 'Operation timed out',
    };
  }

  // Abort (AbortController)
  if (err.name === 'AbortError') {
    return {
      status: 499,
      code: 'CLIENT_CLOSED_REQUEST',
      message: 'Request was aborted',
    };
  }

  // Express body parser errors
  if (err.type === 'entity.too.large') {
    return {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    };
  }
  if (err.type === 'entity.parse.failed') {
    return {
      status: 400,
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON',
    };
  }

  // Unknown — safe default
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}

/* =============================================================================
 * ERROR HANDLER
 * ========================================================================== */

export function applyErrorMiddleware(app, loggerOverride) {
  const log = loggerOverride || logger;

  // 404 — must be registered after all routes but before the error handler.
  app.use(notFoundHandler);

  // Error handler — Express identifies this as an error handler by arity (4 args).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const normalized = normalizeError(err);

    // Log with full context. Never log secrets — redact request bodies.
    const logContext = {
      err,
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: normalized.status,
      code: normalized.code,
      userId: req.auth?.userId || null,
      workspaceId: req.workspace?.id || null,
      body: req.body ? redactSensitive(req.body) : undefined,
      params: req.params,
      query: req.query,
    };

    if (normalized.status >= 500) {
      log.error(logContext, 'Request failed');
    } else if (normalized.status >= 400) {
      log.warn(logContext, 'Request rejected');
    }

    // In development, include a stack snippet in the response for debugging.
    const responseBody = {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details ? { details: normalized.details } : {}),
        ...(config.isDevelopment && normalized.status >= 500
          ? { stack: String(err.stack || '').split('\n').slice(0, 6) }
          : {}),
      },
      meta: {
        requestId: req.id,
        timestamp: new Date().toISOString(),
      },
    };

    if (res.headersSent) {
      // Response already partially written; just close.
      return res.end();
    }

    res.status(normalized.status).json(responseBody);
  });
}

export default applyErrorMiddleware;
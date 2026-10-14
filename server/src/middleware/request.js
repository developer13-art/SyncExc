/**
 * SyncExc Server — Request middleware
 *
 *   - Request ID: assigns or accepts an X-Request-Id header
 *   - HTTP logger: structured request/response logs with redaction
 *   - Body parser: JSON and URL-encoded with size limits
 *   - Cookie parser: parses cookies for session lookup
 */

import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import config from '../config.js';
import { createLogger } from '../lib/logger.js';
import { redactSensitive } from '../lib/mask.js';

const logger = createLogger({ component: 'http' });

/* =============================================================================
 * REQUEST ID
 * ========================================================================== */

function requestIdMiddleware(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

/* =============================================================================
 * HTTP LOGGER
 * ========================================================================== */

function httpLoggerMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const durationMs = Number(elapsedNs) / 1_000_000;

    const level =
      res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](
      {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        route: req.route?.path || req.path,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        contentLength: res.getHeader('content-length') || null,
        userAgent: req.headers['user-agent'] || null,
        ip: req.ip,
        userId: req.auth?.userId || null,
        workspaceId: req.workspace?.id || null,
      },
      'HTTP request'
    );
  });

  next();
}

/* =============================================================================
 * BODY PARSER
 * ========================================================================== */

function bodyParserMiddleware(app) {
  // Webhook routes need the raw body for signature verification.
  // We parse JSON everywhere, but keep a raw copy for paths that need it.
  app.use(
    express.json({
      limit: `${config.storage.upload.maxFileSizeMb}mb`,
      strict: true,
      verify(req, _res, buf) {
        // Preserve raw body on webhook routes so signature verifiers can use it.
        if (req.originalUrl?.includes('/webhooks/')) {
          req.rawBody = buf.toString('utf8');
        }
      },
    })
  );

  app.use(
    express.urlencoded({
      limit: `${config.storage.upload.maxFileSizeMb}mb`,
      extended: true,
      parameterLimit: 1000,
    })
  );
}

/* =============================================================================
 * COOKIE PARSER
 * ========================================================================== */

function cookieMiddleware(app) {
  app.use(cookieParser(config.session.secret));
}

/* =============================================================================
 * REQUEST SIZE GUARD
 * ========================================================================== */

function requestSizeGuard(req, res, next) {
  const contentLength = Number(req.headers['content-length'] || 0);
  const maxBytes = config.storage.upload.maxFileSizeBytes;
  if (contentLength > maxBytes) {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds ${config.storage.upload.maxFileSizeMb} MB`,
      },
      meta: { requestId: req.id, timestamp: new Date().toISOString() },
    });
    return;
  }
  next();
}

/* =============================================================================
 * BODY REDACTION FOR LOGS
 * ========================================================================== */

/**
 * Attach a redacted view of the request body onto the request object.
 * Not used by the app directly, but available to anything that needs to log
 * a safe representation of the body.
 */
function attachRedactedBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    Object.defineProperty(req, 'bodyRedacted', {
      value: redactSensitive(req.body),
      enumerable: false,
      configurable: true,
    });
  }
  next();
}

/* =============================================================================
 * APPLY
 * ========================================================================== */

export function applyRequestMiddleware(app) {
  app.use(requestIdMiddleware);
  app.use(httpLoggerMiddleware);
  cookieMiddleware(app);
  bodyParserMiddleware(app);
  app.use(requestSizeGuard);
  app.use(attachRedactedBody);
}

export default applyRequestMiddleware;
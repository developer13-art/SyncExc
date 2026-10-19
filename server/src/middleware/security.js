/**
 * SyncExc Server — Security middleware
 *
 * Applied first in the pipeline:
 *   - Helmet with a strict Content Security Policy
 *   - CORS restricted to configured origins
 *   - Compression for responses above a size threshold
 *   - HSTS (only in production, only over HTTPS)
 *
 * CSP is disabled in development to allow hot reload tooling.
 */

import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import config from '../config.js';

export function getAllowedOrigins(serverConfig) {
  const origins = new Set(serverConfig.server.corsOrigins);
  if (!serverConfig.isProduction) return origins;

  const domain = serverConfig.app.domain.toLowerCase().replace(/\.$/, '');
  for (const hostname of [domain, `www.${domain}`, `app.${domain}`, `admin.${domain}`]) {
    origins.add(`https://${hostname}`);
  }
  return origins;
}

export function applySecurityMiddleware(app) {
  /* -------------------------------------------------------------------------
   * Compression
   * ----------------------------------------------------------------------- */
  app.use(
    compression({
      threshold: 1024,
      level: 6,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    })
  );

  /* -------------------------------------------------------------------------
   * CORS
   * ----------------------------------------------------------------------- */
  const allowedOrigins = getAllowedOrigins(config);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests with no Origin (server-to-server, curl, mobile)
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        // Allow same-origin requests in production
        if (config.isProduction && origin === config.app.url) return callback(null, true);
        return callback(new Error(`Origin not allowed: ${origin}`), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'X-Correlation-Id',
        'Idempotency-Key',
        'X-Idempotency-Key',
        'X-Client-Name',
        'X-Client-Version',
        'X-SyncExc-Signature',
        'X-SyncExc-Timestamp',
        'X-Api-Key',
        'X-Workspace-Id',
      ],
      exposedHeaders: [
        'X-Request-Id',
        'X-Correlation-Id',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Retry-After',
      ],
      maxAge: 86400,
    })
  );

  /* -------------------------------------------------------------------------
   * Helmet
   * ----------------------------------------------------------------------- */
  if (!config.security.helmetEnabled) return;

  const cspDirectives = config.security.cspEnabled
    ? {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        objectSrc: ["'none'"],
        scriptSrc: config.isDevelopment
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
          : ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        connectSrc: config.isDevelopment
          ? ["'self'", 'ws:', 'wss:', 'http:', 'https:']
          : ["'self'", 'wss:', 'https:'],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      }
    : false;

  app.use(
    helmet({
      contentSecurityPolicy: config.security.cspEnabled
        ? { directives: cspDirectives, useDefaults: false }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: config.security.hstsEnabled
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    })
  );
}

export default applySecurityMiddleware;
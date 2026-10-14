/**
 * SyncExc Server — Response helpers
 *
 * Every API response has a consistent envelope.
 *
 * Success:
 *   { "data": {...}, "meta": { "requestId": "...", "timestamp": "..." } }
 *
 * Error:
 *   { "error": { "code": "...", "message": "...", "details": {...} },
 *     "meta":  { "requestId": "...", "timestamp": "..." } }
 *
 * Paginated:
 *   { "data": [...], "pagination": { "nextCursor": "...", "limit": 50 },
 *     "meta": { ... } }
 */

import { randomUUID } from 'node:crypto';

export function getRequestId(req) {
  return req.id || req.headers['x-request-id'] || randomUUID();
}

export function success(res, data, { status = 200, meta } = {}) {
  return res.status(status).json({
    data,
    meta: {
      requestId: getRequestId(res.req),
      timestamp: new Date().toISOString(),
      ...(meta || {}),
    },
  });
}

export function created(res, data, meta) {
  return success(res, data, { status: 201, meta });
}

export function noContent(res) {
  return res.status(204).end();
}

export function paginated(res, items, { nextCursor, prevCursor, limit, total } = {}) {
  return res.status(200).json({
    data: items,
    pagination: {
      nextCursor: nextCursor ?? null,
      prevCursor: prevCursor ?? null,
      limit: limit ?? items.length,
      ...(total !== undefined ? { total } : {}),
    },
    meta: {
      requestId: getRequestId(res.req),
      timestamp: new Date().toISOString(),
    },
  });
}

export function errorResponse(res, { code, message, details, status = 500 }) {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: {
      requestId: getRequestId(res.req),
      timestamp: new Date().toISOString(),
    },
  });
}
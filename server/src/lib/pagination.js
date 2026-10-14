/**
 * SyncExc Server — Pagination helpers
 *
 * Two strategies:
 *   - Cursor (keyset) pagination: preferred for large, frequently-inserted tables.
 *   - Offset pagination: acceptable for small, bounded tables.
 *
 * Both return a normalized shape.
 */

import { ValidationError } from './errors.js';

/* =============================================================================
 * CURSOR PAGINATION
 * ========================================================================== */

/**
 * Parse cursor pagination params from a query object.
 * Returns { limit, cursor } with safe defaults.
 */
export function parseCursorParams(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  let limit = defaultLimit;
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > maxLimit) {
      throw new ValidationError('Invalid limit', { limit: `must be between 1 and ${maxLimit}` });
    }
    limit = n;
  }

  let cursor = null;
  if (query.cursor) {
    try {
      cursor = JSON.parse(Buffer.from(String(query.cursor), 'base64url').toString('utf8'));
    } catch {
      throw new ValidationError('Invalid cursor');
    }
  }

  return { limit, cursor };
}

/**
 * Encode a cursor object to a base64url string.
 */
export function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/**
 * Build the response pagination metadata.
 */
export function buildCursorMeta({ items, limit, getCursor }) {
  const hasMore = items.length > limit;
  const trimmed = hasMore ? items.slice(0, limit) : items;
  const last = trimmed[trimmed.length - 1];
  return {
    items: trimmed,
    meta: {
      nextCursor: hasMore && last ? encodeCursor(getCursor(last)) : null,
      limit,
      count: trimmed.length,
    },
  };
}

/* =============================================================================
 * OFFSET PAGINATION
 * ========================================================================== */

export function parseOffsetParams(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  let limit = defaultLimit;
  if (query.limit !== undefined) {
    const n = Number(query.limit);
    if (!Number.isInteger(n) || n < 1 || n > maxLimit) {
      throw new ValidationError('Invalid limit', { limit: `must be between 1 and ${maxLimit}` });
    }
    limit = n;
  }

  let offset = 0;
  if (query.offset !== undefined) {
    const n = Number(query.offset);
    if (!Number.isInteger(n) || n < 0) {
      throw new ValidationError('Invalid offset', { offset: 'must be a non-negative integer' });
    }
    offset = n;
  }

  return { limit, offset };
}

export function buildOffsetMeta({ limit, offset, total }) {
  return {
    limit,
    offset,
    total,
    hasNext: offset + limit < total,
    hasPrev: offset > 0,
  };
}

/* =============================================================================
 * QUERY BUILDER HELPERS
 * ========================================================================== */

/**
 * Build SQL ORDER BY + LIMIT for cursor pagination.
 * Caller supplies the cursor column name and direction.
 *
 * Returns a fragment `ORDER BY col [DESC] LIMIT $n` and the params array.
 */
export function buildCursorQuery({ cursorColumn, direction = 'desc', limit, cursor, params = [] }) {
  const nextParams = [...params];
  let where = '';
  if (cursor && cursor.value !== undefined) {
    const op = direction === 'desc' ? '<' : '>';
    nextParams.push(cursor.value);
    where = `AND ${cursorColumn} ${op} $${nextParams.length}`;
  }
  nextParams.push(limit + 1); // fetch one extra to detect hasMore
  const orderBy = `ORDER BY ${cursorColumn} ${direction === 'desc' ? 'DESC' : 'ASC'}`;
  const limitClause = `LIMIT $${nextParams.length}`;
  return { where, orderBy, limitClause, params: nextParams };
}

export default {
  parseCursorParams,
  encodeCursor,
  buildCursorMeta,
  parseOffsetParams,
  buildOffsetMeta,
  buildCursorQuery,
};
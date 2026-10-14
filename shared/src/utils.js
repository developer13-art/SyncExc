/**
 * SyncExc Shared Utilities
 *
 * Pure functions used on both server and client. No I/O, no framework
 * dependency. Every function is deterministic given its inputs.
 */

/* =============================================================================
 * DECIMAL / NUMBER
 * ========================================================================== */

/**
 * Round a decimal string to a fixed scale using the given rounding mode.
 * Uses integer arithmetic to avoid floating point drift.
 */
export function roundDecimal(value, scale, mode = 'half_even') {
  const str = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid decimal: ${value}`);
  }

  const negative = str.startsWith('-');
  const absStr = negative ? str.slice(1) : str;
  const [intPart, fracPart = ''] = absStr.split('.');

  if (fracPart.length <= scale) {
    const padded = fracPart.padEnd(scale, '0');
    const result = scale === 0 ? intPart : `${intPart}.${padded}`;
    return negative ? `-${result}` : result;
  }

  const kept = fracPart.slice(0, scale);
  const nextDigit = Number(fracPart[scale]);
  const afterNext = fracPart.slice(scale + 1).replace(/0+$/, '');

  let roundUp = false;
  if (mode === 'round_up' || mode === 'ceil') {
    roundUp = nextDigit > 0 || afterNext.length > 0;
  } else if (mode === 'round_down' || mode === 'floor') {
    roundUp = false;
  } else if (mode === 'half_up') {
    roundUp = nextDigit >= 5;
  } else if (mode === 'half_even') {
    if (nextDigit > 5) roundUp = true;
    else if (nextDigit < 5) roundUp = false;
    else if (afterNext.length > 0) roundUp = true;
    else roundUp = Number(kept.slice(-1) || '0') % 2 === 1;
  }

  let result = kept;
  if (roundUp) {
    result = (BigInt(kept || '0') + 1n).toString().padStart(scale, '0');
    if (result.length > scale) {
      const overflow = result.slice(0, result.length - scale);
      result = result.slice(result.length - scale);
      const newInt = (BigInt(intPart) + BigInt(overflow)).toString();
      const formatted = scale === 0 ? newInt : `${newInt}.${result}`;
      return negative ? `-${formatted}` : formatted;
    }
  }

  const formatted = scale === 0 ? intPart : `${intPart}.${result}`;
  return negative ? `-${formatted}` : formatted;
}

/** Sum a list of decimal strings exactly. */
export function sumDecimals(values) {
  let total = 0n;
  let scale = 0;
  for (const v of values) {
    const str = String(v);
    const dotIdx = str.indexOf('.');
    const s = dotIdx === -1 ? 0 : str.length - dotIdx - 1;
    scale = Math.max(scale, s);
  }
  for (const v of values) {
    const str = String(v);
    const dotIdx = str.indexOf('.');
    const frac = dotIdx === -1 ? '' : str.slice(dotIdx + 1);
    const padded = frac.padEnd(scale, '0');
    const intPart = dotIdx === -1 ? str : str.slice(0, dotIdx);
    const combined = `${intPart}${padded}`;
    total += BigInt(combined);
  }
  const totalStr = total.toString().padStart(scale + 1, '0');
  if (scale === 0) return totalStr;
  const cut = totalStr.length - scale;
  return `${totalStr.slice(0, cut)}.${totalStr.slice(cut)}`;
}

/** Compare two decimal strings. Returns -1, 0, or 1. */
export function compareDecimals(a, b) {
  const scale = Math.max(decimalScale(a), decimalScale(b));
  const ai = BigInt(toIntegerString(a, scale));
  const bi = BigInt(toIntegerString(b, scale));
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

function decimalScale(value) {
  const str = String(value);
  const dot = str.indexOf('.');
  return dot === -1 ? 0 : str.length - dot - 1;
}

function toIntegerString(value, scale) {
  const str = String(value);
  const neg = str.startsWith('-');
  const abs = neg ? str.slice(1) : str;
  const [intPart, frac = ''] = abs.split('.');
  const padded = frac.padEnd(scale, '0');
  return `${neg ? '-' : ''}${intPart}${padded}`;
}

/* =============================================================================
 * HASHING (non-cryptographic, for client-side fingerprints)
 * ========================================================================== */

/**
 * Fast non-cryptographic hash (FNV-1a 32-bit). For deduplication on client
 * or content fingerprints where cryptographic strength is not required.
 */
export function fnv1aHash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Deterministic JSON stringify — sorts object keys at every level. */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/* =============================================================================
 * IDEMPOTENCY
 * ========================================================================== */

/**
 * Build a deterministic idempotency key from structured parts.
 * Stable across processes and time.
 */
export function buildIdempotencyKey(parts) {
  const normalized = parts.filter((p) => p !== undefined && p !== null).map(String);
  return fnv1aHash(normalized.join('|'));
}

/* =============================================================================
 * DATE / TIME
 * ========================================================================== */

/** Return current time in ISO 8601 UTC. */
export function nowIso() {
  return new Date().toISOString();
}

/** Format a date for display in a given timezone. */
export function formatDate(date, timezone = 'UTC', locale = 'en-US') {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(d);
}

/** Format a date as YYYY-MM-DD in UTC. */
export function formatDateShort(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

/** Parse ISO 8601 into a Date; return null on failure. */
export function parseIso(str) {
  if (typeof str !== 'string') return null;
  const d = new Date(str);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Whole days between two dates. */
export function daysBetween(a, b) {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.floor((db - da) / 86400000);
}

/** Add milliseconds to a date, returning a new Date. */
export function addMs(date, ms) {
  return new Date(new Date(date).getTime() + ms);
}

/* =============================================================================
 * RETRY / BACKOFF
 * ========================================================================== */

/**
 * Compute exponential backoff delay with jitter.
 * @param {number} attempt      Zero-based attempt number.
 * @param {number} baseMs       Initial delay.
 * @param {number} maxMs        Cap.
 * @param {number} jitterRatio  Fraction of delay to randomize.
 */
export function backoffDelay(attempt, baseMs = 1000, maxMs = 300000, jitterRatio = 0.25) {
  const raw = Math.min(baseMs * 2 ** attempt, maxMs);
  const jitter = raw * jitterRatio * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(raw + jitter));
}

/** Sleep for a given number of milliseconds. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry an async function with exponential backoff. */
export async function retry(fn, { attempts = 5, baseMs = 500, maxMs = 30000 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) break;
      await sleep(backoffDelay(i, baseMs, maxMs));
    }
  }
  throw lastError;
}

/* =============================================================================
 * STRING
 * ========================================================================== */

/** Truncate a string without splitting unicode surrogates. */
export function truncate(str, maxLen, suffix = '…') {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - suffix.length) + suffix;
}

/** Convert a string to a URL-friendly slug. */
export function slugify(str) {
  return String(str)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/** Title-case a string. */
export function titleCase(str) {
  return String(str)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* =============================================================================
 * MASKING (for display of sensitive values)
 * ========================================================================== */

/** Mask all but the last `visible` characters. */
export function maskString(value, { visible = 4, mask = '•' } = {}) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= visible) return mask.repeat(str.length);
  return mask.repeat(str.length - visible) + str.slice(-visible);
}

/** Mask an email: j***@example.com */
export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 6))}${local.slice(-1)}@${domain}`;
}

/** Mask an API key: sk_live_xxxx...yyyy */
export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 12) return maskString(key, { visible: 3 });
  return `${key.slice(0, 8)}${'•'.repeat(6)}${key.slice(-4)}`;
}

/* =============================================================================
 * PAGINATION
 * ========================================================================== */

/** Encode a cursor for keyset pagination. */
export function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/** Decode a cursor; throws if invalid. */
export function decodeCursor(str) {
  try {
    return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid cursor');
  }
}

/* =============================================================================
 * COLLECTIONS
 * ========================================================================== */

/** Group an array of objects by a key function. */
export function groupBy(arr, keyFn) {
  const result = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
  }
  return result;
}

/** Unique values from an array, preserving order. */
export function unique(arr) {
  return Array.from(new Set(arr));
}

/** Chunk an array into groups of `size`. */
export function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

/** Pick listed keys from an object. */
export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

/** Omit listed keys from an object. */
export function omit(obj, keys) {
  const set = new Set(keys);
  const out = {};
  for (const k of Object.keys(obj)) if (!set.has(k)) out[k] = obj[k];
  return out;
}

/** Deep merge two plain objects (mutates and returns `target`). */
export function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) &&
        tv && typeof tv === 'object' && !Array.isArray(tv)) {
      deepMerge(tv, sv);
    } else {
      target[key] = sv;
    }
  }
  return target;
}

/* =============================================================================
 * PROMISES
 * ========================================================================== */

/** Run promises with limited concurrency. */
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Reject a promise if it doesn't resolve within `ms`. */
export function withTimeout(promise, ms, message = 'Operation timed out') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/* =============================================================================
 * SAFE JSON
 * ========================================================================== */

export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(value, fallback = '{}') {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/* =============================================================================
 * EXPORTS MAP
 * ========================================================================== */

export const UTILS = Object.freeze({
  roundDecimal,
  sumDecimals,
  compareDecimals,
  fnv1aHash,
  stableStringify,
  buildIdempotencyKey,
  nowIso,
  formatDate,
  formatDateShort,
  parseIso,
  daysBetween,
  addMs,
  backoffDelay,
  sleep,
  retry,
  truncate,
  slugify,
  titleCase,
  maskString,
  maskEmail,
  maskApiKey,
  encodeCursor,
  decodeCursor,
  groupBy,
  unique,
  chunk,
  pick,
  omit,
  deepMerge,
  mapWithConcurrency,
  withTimeout,
  safeJsonParse,
  safeJsonStringify,
});
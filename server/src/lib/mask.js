/**
 * SyncExc Server — Masking helpers
 *
 * Server-side masking for logging and audit payloads. The client has its own
 * copy in @syncexc/shared, but the server has additional helpers for
 * sanitizing request/response objects before logging.
 */

const SENSITIVE_KEYS = [
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'apiKey',
  'apiSecret',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'authorization',
  'cookie',
  'mfaSecret',
  'recoveryCode',
  'recoveryCodes',
  'webhookSecret',
  'signingSecret',
  'passphrase',
  'privateKey',
  'signature',
];

const SENSITIVE_PATTERN = new RegExp(
  `(${SENSITIVE_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`,
  'i'
);

/**
 * Recursively redact sensitive keys from an object. Returns a new object;
 * does not mutate input.
 */
export function redactSensitive(input, seen = new WeakSet()) {
  if (input === null || typeof input !== 'object') return input;
  if (seen.has(input)) return '[Circular]';
  seen.add(input);

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item, seen));
  }

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_PATTERN.test(key)) {
      out[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      out[key] = redactSensitive(value, seen);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Mask an email for logging: "j***@example.com"
 */
export function maskEmailForLog(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '[invalid]';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `***@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

/**
 * Truncate a string for safe logging of potentially long values.
 */
export function truncateForLog(value, max = 256) {
  const str = String(value ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, max)}...[truncated]`;
}

export const maskLib = {
  redactSensitive,
  maskEmailForLog,
  truncateForLog,
  SENSITIVE_KEYS,
};

export default maskLib;
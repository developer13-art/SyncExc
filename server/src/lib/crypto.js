/**
 * SyncExc Server — Crypto helpers
 *
 * AES-256-GCM envelope encryption, HMAC signatures, secure random tokens,
 * and constant-time comparison.
 *
 * The `ENCRYPTION_MASTER_KEY` environment variable must be a base64-encoded
 * 32-byte key. All ciphertext is versioned so keys can be rotated.
 */

import crypto from 'node:crypto';
import config from '../config.js';
import { AppError } from './errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = config.encryption.keyVersion;

let masterKey;

function getMasterKey() {
  if (masterKey) return masterKey;
  try {
    masterKey = Buffer.from(config.encryption.masterKey, 'base64');
  } catch {
    throw new AppError('ENCRYPTION_MASTER_KEY is not valid base64', {
      code: 'CRYPTO_INVALID_KEY',
      status: 500,
    });
  }
  if (masterKey.length !== 32) {
    throw new AppError('ENCRYPTION_MASTER_KEY must decode to 32 bytes', {
      code: 'CRYPTO_INVALID_KEY_SIZE',
      status: 500,
    });
  }
  return masterKey;
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns a versioned, base64url-encoded string:
 *   `v{version}.{iv}.{ciphertext}.{tag}`
 */
export function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new AppError('Encryption expects a string', { code: 'CRYPTO_INVALID_INPUT', status: 400 });
  }
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    `v${VERSION}`,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

/**
 * Decrypt a value produced by `encrypt`.
 * Throws if the value is malformed or the authentication tag is invalid.
 */
export function decrypt(ciphertext) {
  if (typeof ciphertext !== 'string') {
    throw new AppError('Decryption expects a string', { code: 'CRYPTO_INVALID_INPUT', status: 400 });
  }

  const parts = ciphertext.split('.');
  if (parts.length !== 4 || !parts[0].startsWith('v')) {
    throw new AppError('Ciphertext format is invalid', { code: 'CRYPTO_INVALID_CIPHERTEXT', status: 400 });
  }

  const version = parts[0].slice(1);
  if (version !== String(VERSION) && version !== config.encryption.keyVersion) {
    // In a real key-rotation deployment you would look up a key for the version.
    // For now, only the current version is supported.
    throw new AppError(`Unsupported ciphertext version: ${version}`, {
      code: 'CRYPTO_UNSUPPORTED_VERSION',
      status: 400,
    });
  }

  const iv = Buffer.from(parts[1], 'base64url');
  const data = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[3], 'base64url');

  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new AppError('Ciphertext structure invalid', { code: 'CRYPTO_INVALID_CIPHERTEXT', status: 400 });
  }

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new AppError('Failed to decrypt ciphertext', {
      code: 'CRYPTO_DECRYPTION_FAILED',
      status: 400,
    });
  }
}

/* =============================================================================
 * HASHING
 * ========================================================================== */

export function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

export function sha512(input) {
  return crypto.createHash('sha512').update(String(input)).digest('hex');
}

export function hmacSha256(input, secret) {
  return crypto.createHmac('sha256', secret).update(String(input)).digest('hex');
}

/**
 * Timing-safe comparison of two strings. Returns true if equal.
 */
export function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/* =============================================================================
 * RANDOM TOKENS
 * ========================================================================== */

/**
 * Generate a URL-safe random token of `byteLength` entropy.
 * Use 32 bytes for tokens, 16 for short codes.
 */
export function randomToken(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('base64url');
}

/**
 * Generate a numeric code of a given length (for OTP / verification).
 */
export function randomNumericCode(length = 6) {
  const digits = '0123456789';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) code += digits[bytes[i] % 10];
  return code;
}

/**
 * Generate a base32 secret for TOTP (RFC 6238 compatible alphabet).
 */
export function randomTotpSecret(byteLength = 20) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(byteLength);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += alphabet[bytes[i] % 32];
  return out;
}

/* =============================================================================
 * WEBHOOK SIGNATURES
 * ========================================================================== */

/**
 * Sign a webhook payload with a shared secret.
 * Returns the signature string to send in `X-SyncExc-Signature`.
 */
export function signWebhookPayload(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${timestamp}.${body}`;
  const signature = hmacSha256(signedPayload, secret);
  return { signature, timestamp };
}

/**
 * Verify a webhook signature. Enforces a timestamp tolerance to prevent
 * replay attacks.
 */
export function verifyWebhookSignature({
  payload,
  signature,
  secret,
  timestamp,
  toleranceSeconds = 300,
}) {
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(now - ts) > toleranceSeconds) return false;

  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedPayload = `${ts}.${body}`;
  const expected = hmacSha256(signedPayload, secret);
  return timingSafeEqual(expected, signature);
}

/* =============================================================================
 * PKCE
 * ========================================================================== */

export function generatePkceChallenge() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, method: 'S256' };
}

/* =============================================================================
 * EXPORTS
 * ========================================================================== */

export const cryptoLib = {
  encrypt,
  decrypt,
  sha256,
  sha512,
  hmacSha256,
  timingSafeEqual,
  randomToken,
  randomNumericCode,
  randomTotpSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  generatePkceChallenge,
};

export default cryptoLib;
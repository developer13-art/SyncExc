/**
 * SyncExc Server — OTP / TOTP
 *
 * - TOTP: RFC 6238 time-based codes for MFA.
 * - Numeric codes: for email / SMS verification challenges.
 */

import speakeasy from 'speakeasy';
import crypto from 'node:crypto';

/**
 * Generate a TOTP secret (base32).
 */
export function generateTotpSecret() {
  return speakeasy.generateSecret({
    name: 'SyncExc',
    length: 20,
  });
}

/**
 * Generate the otpauth:// URL for authenticator apps.
 */
export function totpAuthUrl(secret, email) {
  return speakeasy.otpauthURL({
    secret: secret.base32,
    label: `SyncExc:${email}`,
    issuer: 'SyncExc',
    encoding: 'base32',
  });
}

/**
 * Verify a TOTP code with a small window to allow clock drift.
 */
export function verifyTotp(secretBase32, token) {
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token: String(token),
    window: 1,
  });
}

/**
 * Generate a numeric verification code.
 * The code is returned but NEVER stored plaintext; store its hash.
 */
export function generateNumericCode(length = 6) {
  const digits = '0123456789';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) out += digits[bytes[i] % 10];
  return out;
}

/**
 * Hash a numeric code for storage. Uses SHA-256 with a per-code salt to
 * prevent rainbow lookups (the code space is tiny otherwise).
 */
export function hashCode(code, salt) {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

export const otpLib = {
  generateTotpSecret,
  totpAuthUrl,
  verifyTotp,
  generateNumericCode,
  hashCode,
  generateSalt,
};

export default otpLib;
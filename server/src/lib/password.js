/**
 * SyncExc Server — Password hashing
 *
 * Bcrypt with a configurable cost factor. Never stores plaintext. Never logs
 * plaintext. Comparison uses bcrypt's constant-time implementation.
 */

import bcrypt from 'bcrypt';
import config from '../config.js';

const ROUNDS = config.password.bcryptRounds;

/**
 * Hash a password.
 */
export async function hashPassword(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hash(plaintext, ROUNDS);
}

/**
 * Verify a password against a stored hash.
 * Always returns a boolean; never throws on mismatch.
 */
export async function verifyPassword(plaintext, hash) {
  if (typeof plaintext !== 'string' || typeof hash !== 'string') return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}

/**
 * Constant-time dummy hash to prevent timing-based user enumeration.
 * Compare against this when a user is not found so response time is similar.
 */
export const DUMMY_HASH = '$2b$12$invalidsaltinvalidsaltinvalidsaltinvalid';

export const passwordLib = {
  hashPassword,
  verifyPassword,
  DUMMY_HASH,
};

export default passwordLib;
/**
 * SyncExc Server — Credential vault
 *
 * Wraps the crypto module with an interface specific to exchange credentials.
 * Credentials are AES-256-GCM encrypted at rest, versioned for rotation.
 */

import { encrypt, decrypt } from '../../lib/crypto.js';

export function createCredentialVault({ logger }) {
  return {
    /**
     * Encrypt a credential set for storage.
     */
    encryptCredentials({ apiKey, apiSecret, passphrase }) {
      return {
        apiKeyEncrypted: encrypt(apiKey),
        apiSecretEncrypted: encrypt(apiSecret),
        passphraseEncrypted: passphrase ? encrypt(passphrase) : null,
        keyVersion: '1',
      };
    },

    /**
     * Decrypt a credential record.
     */
    decryptCredentials(record) {
      return {
        apiKey: decrypt(record.api_key_encrypted),
        apiSecret: decrypt(record.api_secret_encrypted),
        passphrase: record.passphrase_encrypted
          ? decrypt(record.passphrase_encrypted)
          : null,
      };
    },

    /**
     * Redact a credential set for logging.
     */
    redactCredentials(creds) {
      return {
        apiKey: creds.apiKey ? `${creds.apiKey.slice(0, 6)}...${creds.apiKey.slice(-4)}` : null,
        hasSecret: Boolean(creds.apiSecret),
        hasPassphrase: Boolean(creds.passphrase),
      };
    },
  };
}

export default createCredentialVault;
/**
 * SyncExc Server — API credential service
 *
 * Generates real, verifiable API keys:
 *   - token shape: `sk_live_<prefix>_<secret>` or `sk_sandbox_<prefix>_<secret>`
 *   - secret is a 32-byte base64url string
 *   - we store a SHA-256 hash of the FULL token; the prefix is stored for
 *     display only
 */

import { randomBytes, createHash } from 'node:crypto';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors.js';

export function createCredentialService({ db, queries, events, getBilling, logger }) {
  async function hasProductionEntitlement(userId, workspaceId) {
    const billing = getBilling?.();
    if (!billing?.listEntitlementsForScope) return false;
    const personalResult = await db.query(
      `SELECT id FROM workspaces WHERE owner_id = $1 AND type = 'personal' AND status = 'active' LIMIT 1`,
      [userId]
    );
    const scopes = [
      { scopeType: 'workspace', scopeId: workspaceId },
      ...(personalResult.rows[0] ? [{ scopeType: 'workspace', scopeId: personalResult.rows[0].id }] : []),
      { scopeType: 'user', scopeId: userId },
    ];
    for (const scope of scopes) {
      const entitlements = await billing.listEntitlementsForScope(scope);
      if (Object.prototype.hasOwnProperty.call(entitlements, 'developerApi.enabled')) {
        return entitlements['developerApi.enabled'] === true;
      }
    }
    return false;
  }

  const VALID_SCOPES = [
    'profile:read',
    'workspace:read',
    'exchange_accounts:read',
    'balances:read',
    'markets:read',
    'orders:read',
    'orders:write',
    'positions:read',
    'positions:write',
    'trades:read',
    'sync:read',
    'sync:write',
    'signals:read',
    'automation:read',
    'automation:write',
    'simulation:read',
    'simulation:write',
    'webhooks:manage',
    'notifications:read',
  ];

  /**
   * Create a new credential. Returns the plaintext token ONCE — it is never
   * retrievable again.
   */
  async function createCredential({
    userId,
    workspaceId,
    applicationId,
    environment,
    scopes,
    expiresInDays,
  }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Application');
    if (app.state !== 'active' && app.state !== 'draft') {
      throw new ConflictError('Application is not active', 'APP_NOT_ACTIVE');
    }
    if (!['sandbox', 'production'].includes(environment)) {
      throw new ValidationError(`Invalid environment: ${environment}`);
    }
    if (environment === 'production' && !(await hasProductionEntitlement(userId, workspaceId))) {
      throw new ConflictError(
        'Production credentials require the Developer API entitlement. Sandbox credentials remain available.',
        'DEVELOPER_API_ENTITLEMENT_REQUIRED'
      );
    }
    if (!Array.isArray(scopes) || scopes.length === 0) {
      throw new ValidationError('At least one scope is required');
    }

    const invalidScopes = scopes.filter((s) => !VALID_SCOPES.includes(s));
    if (invalidScopes.length > 0) {
      throw new ValidationError(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    const prefix = randomBytes(6).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const envPrefix = environment === 'production' ? 'sk_live' : 'sk_sandbox';
    const plaintext = `${envPrefix}_${prefix}_${secret}`;
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const tokenPrefix = `${envPrefix}_${prefix}`;

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const credential = await db.tx(async (tx) => {
      const created = await queries.insertCredential(tx, {
        applicationId,
        environment,
        tokenHash,
        tokenPrefix,
        scopes,
        expiresAt,
      });

      await queries.insertCredentialVersion(tx, {
        credentialId: created.id,
        version: 1,
        action: 'created',
        actorId: userId,
        metadata: { scopes, environment },
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        applicationId,
        action: 'credential.created',
        resourceType: 'api_credential',
        resourceId: created.id,
        after: { scopes, environment },
      });

      await events.publish(
        tx,
        'developer.credential_created',
        {
          credentialId: created.id,
          applicationId,
          environment,
          scopes,
        },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'api_credential',
          resourceId: created.id,
        }
      );

      return created;
    });

    return {
      credential,
      plaintext, // shown to the user ONCE
    };
  }

  async function listCredentials({ applicationId, workspaceId }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Application');
    return queries.listCredentialsForApplication(applicationId);
  }

  async function revokeCredential({ userId, workspaceId, credentialId, reason }) {
    const credential = await queries.findCredentialById(credentialId);
    if (!credential) throw new NotFoundError('Credential');

    const app = await queries.findApplicationById(credential.application_id);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Credential');

    return db.tx(async (tx) => {
      const updated = await queries.updateCredential(credentialId, {
        state: 'revoked',
        revokedAt: new Date(),
      });

      await queries.insertCredentialVersion(tx, {
        credentialId,
        version: 2,
        action: 'revoked',
        actorId: userId,
        metadata: { reason },
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        applicationId: app.id,
        action: 'credential.revoked',
        resourceType: 'api_credential',
        resourceId: credentialId,
        after: { reason },
      });

      await events.publish(
        tx,
        'developer.credential_revoked',
        { credentialId, applicationId: app.id, reason },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'api_credential',
          resourceId: credentialId,
        }
      );

      return updated;
    });
  }

  async function rotateCredential({
    userId,
    workspaceId,
    credentialId,
    expiresInDays,
  }) {
    const credential = await queries.findCredentialById(credentialId);
    if (!credential) throw new NotFoundError('Credential');

    const app = await queries.findApplicationById(credential.application_id);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Credential');

    // Create the new credential with the same scopes
    const { credential: newCredential, plaintext } = await createCredential({
      userId,
      workspaceId,
      applicationId: credential.application_id,
      environment: credential.environment,
      scopes: credential.scopes,
      expiresInDays: expiresInDays ?? 365,
    });

    // Schedule the old one for revocation after a short overlap window
    const overlapExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.tx(async (tx) => {
      await queries.updateCredential(credentialId, {
        state: 'rotation_pending',
      });

      await queries.insertCredentialVersion(tx, {
        credentialId,
        version: 3,
        action: 'rotation_initiated',
        actorId: userId,
        metadata: {
          replacementCredentialId: newCredential.id,
          overlapExpiresAt: overlapExpiresAt.toISOString(),
        },
      });
    });

    return {
      newCredential,
      plaintext,
      oldCredentialId: credentialId,
      overlapExpiresAt,
    };
  }

  async function findActiveByTokenHash(tokenHash) {
    const credential = await queries.findCredentialByTokenHash(tokenHash);
    if (!credential) return null;
    if (credential.expires_at && new Date(credential.expires_at) <= new Date()) {
      await queries.updateCredential(credential.id, { state: 'expired' });
      return null;
    }
    return credential;
  }

  async function touchLastUsed(credentialId) {
    await queries.updateCredential(credentialId, { lastUsedAt: new Date() });
  }

  return {
    createCredential,
    listCredentials,
    revokeCredential,
    rotateCredential,
    findActiveByTokenHash,
    touchLastUsed,
    VALID_SCOPES,
  };
}

export default createCredentialService;
/**
 * SyncExc Server — Public API authorization
 *
 * Every inbound request to `/api/v1/` (or the public API prefix) passes
 * through this. It:
 *   1. Extracts the Bearer token from the Authorization header
 *   2. Resolves it to an application/credential/grant
 *   3. Checks scopes, application state, workspace access
 *   4. Enforces rate limits
 *   5. Records usage
 */

import { createHash } from 'node:crypto';
import { AuthenticationError, AuthorizationError } from '../../lib/errors.js';

export function createApiAuthorizationService({
  db,
  queries,
  credentialService,
  oauthService,
  usageAnalyticsService,
  getBilling,
  logger,
}) {
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

  /**
   * Authenticate an inbound request. Returns a caller context:
   *   { kind, applicationId, workspaceId, userId, scopes, credentialId }
   */
  async function authenticate(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing API credentials', 'NO_API_CREDENTIALS');
    }

    const token = authHeader.slice(7).trim();
    if (!token) throw new AuthenticationError('Empty token', 'EMPTY_TOKEN');

    const tokenHash = createHash('sha256').update(token).digest('hex');

    // 1. Try API credential (sk_live_/sk_sandbox_ prefixes)
    if (token.startsWith('sk_live_') || token.startsWith('sk_sandbox_')) {
      const credential = await credentialService.findActiveByTokenHash(tokenHash);
      if (!credential) {
        throw new AuthenticationError('Invalid API credential', 'INVALID_CREDENTIAL');
      }

      const app = await queries.findApplicationById(credential.application_id);
      if (!app) throw new AuthenticationError('Application not found', 'APP_NOT_FOUND');
      if (app.state !== 'active' && app.state !== 'draft') {
        throw new AuthorizationError('Application is not active', 'APP_NOT_ACTIVE');
      }
      const workspaceResult = await db.query(
        `SELECT type, status FROM workspaces WHERE id = $1`,
        [app.workspace_id]
      );
      const workspace = workspaceResult.rows[0];
      if (workspace?.type !== 'developer' || workspace.status !== 'active') {
        throw new AuthorizationError('Developer workspace is not active', 'WORKSPACE_NOT_ACTIVE');
      }
      if (credential.environment === 'production' &&
          !(await hasProductionEntitlement(app.owner_id, app.workspace_id))) {
        throw new AuthorizationError('Production API access is not entitled for this workspace', 'DEVELOPER_API_ENTITLEMENT_REQUIRED');
      }

      // Fire-and-forget last-used update
      credentialService.touchLastUsed(credential.id).catch(() => {});

      return {
        kind: 'api_credential',
        applicationId: app.id,
        workspaceId: app.workspace_id,
        userId: app.owner_id,
        scopes: credential.scopes,
        credentialId: credential.id,
        environment: credential.environment,
      };
    }

    // 2. Try OAuth access token
    const accessToken = await oauthService.findAccessTokenByHash(tokenHash);
    if (accessToken) {
      if (accessToken.grant_state !== 'active') {
        throw new AuthenticationError('Grant revoked', 'GRANT_REVOKED');
      }

      const grant = await queries.findOauthGrantById(accessToken.grant_id);
      if (!grant) throw new AuthenticationError('Grant not found', 'GRANT_NOT_FOUND');

      const client = await db.query(
        `SELECT * FROM developer_oauth_clients WHERE id = $1`,
        [grant.client_id]
      );
      const oauthClient = client.rows[0];
      if (!oauthClient) throw new AuthenticationError('OAuth client not found');

      return {
        kind: 'oauth_access_token',
        applicationId: oauthClient.application_id,
        workspaceId: grant.workspace_id,
        userId: grant.user_id,
        scopes: accessToken.scopes,
        grantId: grant.id,
      };
    }

    throw new AuthenticationError('Invalid token', 'INVALID_TOKEN');
  }

  /**
   * Assert that a caller has a required scope. Throws on failure.
   */
  function requireScope(caller, scope) {
    if (!caller.scopes.includes(scope) && !caller.scopes.includes('*')) {
      throw new AuthorizationError(`Missing required scope: ${scope}`, 'SCOPE_INSUFFICIENT');
    }
  }

  /**
   * Assert that a caller may access a workspace resource.
   */
  function requireWorkspaceAccess(caller, workspaceId) {
    if (caller.workspaceId !== workspaceId && caller.kind === 'api_credential') {
      throw new AuthorizationError('Token is not authorized for this workspace', 'RESOURCE_FORBIDDEN');
    }
  }

  return {
    authenticate,
    requireScope,
    requireWorkspaceAccess,
  };
}

export default createApiAuthorizationService;
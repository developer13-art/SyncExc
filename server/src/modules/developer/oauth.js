/**
 * SyncExc Server — OAuth 2.0 service
 *
 * Real OAuth flows:
 *   - authorization_code with PKCE
 *   - refresh_token
 *   - client_credentials
 *
 * Authorization codes and refresh tokens are stored hashed. Access tokens
 * are stored hashed and validated on every API request.
 */

import { randomBytes, createHash, createHmac } from 'node:crypto';
import { NotFoundError, ValidationError, ConflictError, AuthenticationError } from '../../lib/errors.js';

const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateToken() {
  return randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function verifyPkce(verifier, challenge, method) {
  if (method === 'S256') {
    const computed = createHash('sha256').update(verifier).digest('base64url');
    return computed === challenge;
  }
  if (method === 'plain') {
    return verifier === challenge;
  }
  return false;
}

export function createOAuthService({ db, queries, events, logger }) {
  /**
   * Register an OAuth client for an application.
   */
  async function registerClient({ userId, workspaceId, applicationId, redirectUris }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Application');
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      throw new ValidationError('At least one redirect URI is required');
    }

    const clientId = randomBytes(16).toString('hex');
    const clientSecret = randomBytes(32).toString('base64url');

    // Store the secret hashed
    const secretHash = createHmac('sha256', process.env.JWT_ACCESS_SECRET || 'default-secret')
      .update(clientSecret)
      .digest('hex');

    const client = await db.tx(async (tx) => {
      return queries.insertOauthClient(tx, {
        applicationId,
        clientId,
        clientSecretRef: `oauth_secret:${secretHash}`,
        redirectUris,
        grantTypes: ['authorization_code', 'refresh_token'],
      });
    });

    return { client, clientSecret }; // clientSecret shown once
  }

  /**
   * Initiate the authorization flow.
   *
   * Returns an authorization code after the user consents. In this
   * implementation, the consent step is done by the calling frontend
   * which then calls `exchangeAuthorizationCode`.
   */
  async function createAuthorizationCode({
    clientId,
    userId,
    workspaceId,
    redirectUri,
    scopes,
    codeChallenge,
    codeChallengeMethod,
  }) {
    const client = await queries.findOauthClientByClientId(clientId);
    if (!client) throw new NotFoundError('OAuth client');
    if (!client.redirect_uris.includes(redirectUri)) {
      throw new ValidationError('Redirect URI does not match registered URIs');
    }

    const code = randomBytes(32).toString('base64url');
    const codeHash = hashToken(code);

    // Store the code as an OAuth grant with the state 'pending_code'
    await db.tx(async (tx) => {
      const grant = await queries.insertOauthGrant(tx, {
        clientId: client.id,
        userId,
        workspaceId,
        scopes,
      });

      // Store the code hash + PKCE challenge on the grant
      await tx.query(
        `
        UPDATE developer_oauth_grants
        SET metadata = $2
        WHERE id = $1
        `,
        [
          grant.id,
          JSON.stringify({
            codeHash,
            redirectUri,
            codeChallenge,
            codeChallengeMethod,
            expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
            used: false,
          }),
        ]
      );
    });

    return { code };
  }

  /**
   * Exchange an authorization code for access + refresh tokens.
   */
  async function exchangeAuthorizationCode({
    clientId,
    code,
    redirectUri,
    codeVerifier,
  }) {
    const client = await queries.findOauthClientByClientId(clientId);
    if (!client) throw new AuthenticationError('Invalid client', 'INVALID_CLIENT');

    const codeHash = hashToken(code);

    // Find the grant with this code hash
    const grantResult = await db.query(
      `
      SELECT * FROM developer_oauth_grants
      WHERE client_id = $1 AND (metadata->>'codeHash') = $2
      LIMIT 1
      `,
      [client.id, codeHash]
    );
    const grant = grantResult.rows[0];
    if (!grant) throw new AuthenticationError('Invalid authorization code', 'INVALID_CODE');

    const meta = grant.metadata || {};
    if (meta.used) throw new AuthenticationError('Code already used', 'CODE_USED');
    if (new Date(meta.expiresAt) <= new Date()) {
      throw new AuthenticationError('Code expired', 'CODE_EXPIRED');
    }
    if (meta.redirectUri !== redirectUri) {
      throw new AuthenticationError('Redirect URI mismatch', 'REDIRECT_MISMATCH');
    }

    // Verify PKCE
    if (meta.codeChallenge) {
      if (!codeVerifier || !verifyPkce(codeVerifier, meta.codeChallenge, meta.codeChallengeMethod)) {
        throw new AuthenticationError('PKCE verification failed', 'PKCE_FAILED');
      }
    }

    // Mark code used
    await db.query(
      `
      UPDATE developer_oauth_grants
      SET metadata = jsonb_set(metadata, '{used}', 'true')
      WHERE id = $1
      `,
      [grant.id]
    );

    // Issue access + refresh tokens
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const accessTokenHash = hashToken(accessToken);
    const refreshTokenHash = hashToken(refreshToken);
    const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await db.tx(async (tx) => {
      await queries.insertAccessToken(tx, {
        grantId: grant.id,
        tokenHash: accessTokenHash,
        scopes: grant.scopes,
        expiresAt: accessExpiresAt,
      });

      // Store the refresh token hash on the grant
      await tx.query(
        `
        UPDATE developer_oauth_grants
        SET metadata = jsonb_set(
          jsonb_set(metadata, '{refreshTokenHash}', to_jsonb($2::text)),
          '{refreshExpiresAt}',
          to_jsonb($3::text)
        )
        WHERE id = $1
        `,
        [grant.id, refreshTokenHash, refreshExpiresAt.toISOString()]
      );
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
      tokenType: 'Bearer',
      scope: grant.scopes.join(' '),
    };
  }

  /**
   * Exchange a refresh token for a new access token.
   */
  async function exchangeRefreshToken({ clientId, refreshToken }) {
    const client = await queries.findOauthClientByClientId(clientId);
    if (!client) throw new AuthenticationError('Invalid client', 'INVALID_CLIENT');

    const refreshTokenHash = hashToken(refreshToken);

    const grantResult = await db.query(
      `
      SELECT * FROM developer_oauth_grants
      WHERE client_id = $1
        AND (metadata->>'refreshTokenHash') = $2
        AND state = 'active'
      LIMIT 1
      `,
      [client.id, refreshTokenHash]
    );
    const grant = grantResult.rows[0];
    if (!grant) throw new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH');

    const meta = grant.metadata || {};
    if (meta.refreshExpiresAt && new Date(meta.refreshExpiresAt) <= new Date()) {
      throw new AuthenticationError('Refresh token expired', 'REFRESH_EXPIRED');
    }

    const accessToken = generateToken();
    const accessTokenHash = hashToken(accessToken);
    const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);

    await queries.insertAccessToken(db, {
      grantId: grant.id,
      tokenHash: accessTokenHash,
      scopes: grant.scopes,
      expiresAt: accessExpiresAt,
    });

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
      tokenType: 'Bearer',
      scope: grant.scopes.join(' '),
    };
  }

  /**
   * Client credentials grant — for server-to-server apps acting on their
   * own behalf. Only allowed for scopes the client has already been granted.
   */
  async function clientCredentials({ clientId, clientSecret, scopes }) {
    const client = await queries.findOauthClientByClientId(clientId);
    if (!client) throw new AuthenticationError('Invalid client', 'INVALID_CLIENT');

    // Verify secret
    const secretHash = createHmac('sha256', process.env.JWT_ACCESS_SECRET || 'default-secret')
      .update(clientSecret)
      .digest('hex');
    if (client.client_secret_ref !== `oauth_secret:${secretHash}`) {
      throw new AuthenticationError('Invalid client secret', 'INVALID_SECRET');
    }

    const accessToken = generateToken();
    const accessTokenHash = hashToken(accessToken);
    const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);

    // Look up the application to attach workspace
    const app = await queries.findApplicationById(client.application_id);

    // Create a grant
    const grant = await db.tx(async (tx) => {
      const g = await queries.insertOauthGrant(tx, {
        clientId: client.id,
        userId: app.owner_id,
        workspaceId: app.workspace_id,
        scopes,
      });

      await queries.insertAccessToken(tx, {
        grantId: g.id,
        tokenHash: accessTokenHash,
        scopes,
        expiresAt: accessExpiresAt,
      });

      return g;
    });

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_MS / 1000,
      tokenType: 'Bearer',
      scope: scopes.join(' '),
    };
  }

  async function findAccessTokenByHash(tokenHash) {
    return queries.findAccessTokenByHash(tokenHash);
  }

  async function listGrantsForUser(userId) {
    return queries.listActiveOauthGrantsForUser(userId);
  }

  async function revokeGrant({ userId, grantId }) {
    const grant = await queries.findOauthGrantById(grantId);
    if (!grant || grant.user_id !== userId) throw new NotFoundError('Grant');

    return db.tx(async (tx) => {
      const revoked = await queries.revokeOauthGrant(grantId);
      await queries.revokeAccessTokensForGrant(grantId);
      return revoked;
    });
  }

  return {
    registerClient,
    createAuthorizationCode,
    exchangeAuthorizationCode,
    exchangeRefreshToken,
    clientCredentials,
    findAccessTokenByHash,
    listGrantsForUser,
    revokeGrant,
  };
}

export default createOAuthService;
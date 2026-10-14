/**
 * SyncExc Server — Identity module queries
 *
 * Every SQL statement used by the identity module. Kept in one place so
 * schema changes have exactly one place to update.
 */

export function createIdentityQueries({ db }) {
  return {
    /* =========================================================================
     * USERS
     * ====================================================================== */

    async insertUser(client, data) {
      const result = await client.query(
        `
        INSERT INTO users (
          email, email_normalized, password_hash, username, username_normalized,
          display_name, preferred_language, timezone, country_code, status,
          terms_version, terms_accepted_at, privacy_version, privacy_accepted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), $12, now())
        RETURNING *
        `,
        [
          data.email,
          data.emailNormalized,
          data.passwordHash,
          data.username,
          data.usernameNormalized,
          data.displayName,
          data.preferredLanguage || 'en',
          data.timezone || 'UTC',
          data.countryCode || null,
          'pending_verification',
          data.termsVersion || null,
          data.privacyVersion || null,
        ]
      );
      return result.rows[0];
    },

    async findUserById(userId, client = db) {
      const result = await client.query(
        `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
      );
      return result.rows[0] || null;
    },

    async findUserByEmail(emailNormalized, client = db) {
      const result = await client.query(
        `SELECT * FROM users WHERE email_normalized = $1 AND deleted_at IS NULL`,
        [emailNormalized]
      );
      return result.rows[0] || null;
    },

    async findUserByUsername(usernameNormalized, client = db) {
      const result = await client.query(
        `SELECT * FROM users WHERE username_normalized = $1 AND deleted_at IS NULL`,
        [usernameNormalized]
      );
      return result.rows[0] || null;
    },

    async emailExists(emailNormalized, client = db) {
      const result = await client.query(
        `SELECT 1 FROM users WHERE email_normalized = $1 AND deleted_at IS NULL LIMIT 1`,
        [emailNormalized]
      );
      return result.rows.length > 0;
    },

    async usernameExists(usernameNormalized, client = db) {
      const result = await client.query(
        `SELECT 1 FROM users WHERE username_normalized = $1 AND deleted_at IS NULL LIMIT 1`,
        [usernameNormalized]
      );
      return result.rows.length > 0;
    },

    async updateUserProfile(userId, fields) {
      const result = await db.query(
        `
        UPDATE users
        SET display_name = COALESCE($2, display_name),
            username = COALESCE($3, username),
            username_normalized = COALESCE($4, username_normalized),
            preferred_language = COALESCE($5, preferred_language),
            timezone = COALESCE($6, timezone),
            country_code = COALESCE($7, country_code),
            updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        `,
        [
          userId,
          fields.displayName || null,
          fields.username || null,
          fields.usernameNormalized || null,
          fields.preferredLanguage || null,
          fields.timezone || null,
          fields.countryCode || null,
        ]
      );
      return result.rows[0] || null;
    },

    async updateUserEmail(userId, email, emailNormalized) {
      const result = await db.query(
        `
        UPDATE users
        SET email = $2, email_normalized = $3, email_verified_at = NULL, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        `,
        [userId, email, emailNormalized]
      );
      return result.rows[0] || null;
    },

    async markEmailVerified(userId) {
      const result = await db.query(
        `
        UPDATE users
        SET email_verified_at = now(),
            status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END,
            updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        `,
        [userId]
      );
      return result.rows[0] || null;
    },

    async updatePasswordHash(userId, passwordHash) {
      const result = await db.query(
        `
        UPDATE users
        SET password_hash = $2, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        `,
        [userId, passwordHash]
      );
      return result.rows[0] || null;
    },

    async updateUserStatus(userId, status) {
      const result = await db.query(
        `
        UPDATE users SET status = $2, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
        `,
        [userId, status]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * SESSIONS
     * ====================================================================== */

    async insertSession(client, data) {
      const result = await client.query(
        `
        INSERT INTO user_sessions (
          user_id, session_token_hash, device_id, device_label,
          ip_address, user_agent, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          data.userId,
          data.sessionTokenHash,
          data.deviceId || null,
          data.deviceLabel || null,
          data.ipAddress || null,
          data.userAgent || null,
          data.expiresAt,
        ]
      );
      return result.rows[0];
    },

    async findSessionByTokenHash(tokenHash) {
      const result = await db.query(
        `
        SELECT * FROM user_sessions
        WHERE session_token_hash = $1
        LIMIT 1
        `,
        [tokenHash]
      );
      return result.rows[0] || null;
    },

    async findSessionById(sessionId) {
      const result = await db.query(`SELECT * FROM user_sessions WHERE id = $1`, [sessionId]);
      return result.rows[0] || null;
    },

    async listActiveSessionsForUser(userId) {
      const result = await db.query(
        `
        SELECT * FROM user_sessions
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        ORDER BY last_activity_at DESC
        `,
        [userId]
      );
      return result.rows;
    },

    async touchSessionActivity(sessionId) {
      await db.query(
        `UPDATE user_sessions SET last_activity_at = now() WHERE id = $1`,
        [sessionId]
      );
    },

    async setSessionStepUp(sessionId) {
      await db.query(
        `UPDATE user_sessions SET step_up_at = now() WHERE id = $1`,
        [sessionId]
      );
    },

    async revokeSession(sessionId, reason = null) {
      const result = await db.query(
        `
        UPDATE user_sessions
        SET revoked_at = now(),
            user_agent = COALESCE(user_agent, '') || CASE WHEN $2::text IS NOT NULL THEN ' [revoked: ' || $2 || ']' ELSE '' END
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING id
        `,
        [sessionId, reason]
      );
      return result.rowCount > 0;
    },

    async revokeAllSessionsForUser(userId, { exceptSessionId = null } = {}) {
      const result = await db.query(
        `
        UPDATE user_sessions
        SET revoked_at = now()
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND ($2::uuid IS NULL OR id <> $2)
        RETURNING id
        `,
        [userId, exceptSessionId]
      );
      return result.rowCount;
    },

    /* =========================================================================
     * CHALLENGES
     * ====================================================================== */

    async insertChallenge(client, data) {
      const result = await client.query(
        `
        INSERT INTO auth_challenges (
          user_id, email, challenge_type, token_hash, code_hash, salt,
          metadata, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          data.userId || null,
          data.email || null,
          data.challengeType,
          data.tokenHash,
          data.codeHash || null,
          data.salt || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.expiresAt,
        ]
      );
      return result.rows[0];
    },

    async findChallengeByTokenHash(tokenHash) {
      const result = await db.query(
        `SELECT * FROM auth_challenges WHERE token_hash = $1 LIMIT 1`,
        [tokenHash]
      );
      return result.rows[0] || null;
    },

    async consumeChallenge(challengeId) {
      const result = await db.query(
        `
        UPDATE auth_challenges
        SET consumed_at = now()
        WHERE id = $1 AND consumed_at IS NULL
        RETURNING id
        `,
        [challengeId]
      );
      return result.rowCount > 0;
    },

    async incrementChallengeAttempts(challengeId) {
      await db.query(
        `UPDATE auth_challenges SET attempt_count = attempt_count + 1 WHERE id = $1`,
        [challengeId]
      );
    },

    async invalidateActiveChallenges({ userId = null, email = null, challengeType }) {
      await db.query(
        `
        UPDATE auth_challenges
        SET consumed_at = now()
        WHERE challenge_type = $1
          AND consumed_at IS NULL
          AND (($2::uuid IS NOT NULL AND user_id = $2) OR ($3::text IS NOT NULL AND email = $3))
        `,
        [challengeType, userId, email]
      );
    },

    /* =========================================================================
     * RECOVERY CODES
     * ====================================================================== */

    async insertRecoveryCodes(client, userId, verifiers) {
      if (verifiers.length === 0) return;
      const values = [];
      const params = [];
      let idx = 1;
      for (const verifier of verifiers) {
        values.push(`($${idx++}, $${idx++})`);
        params.push(userId, verifier);
      }
      await client.query(
        `
        INSERT INTO user_recovery_codes (user_id, code_verifier)
        VALUES ${values.join(', ')}
        `,
        params
      );
    },

    async findUnusedRecoveryCodes(userId) {
      const result = await db.query(
        `
        SELECT * FROM user_recovery_codes
        WHERE user_id = $1 AND used_at IS NULL AND revoked_at IS NULL
        `,
        [userId]
      );
      return result.rows;
    },

    async markRecoveryCodeUsed(codeId) {
      const result = await db.query(
        `
        UPDATE user_recovery_codes
        SET used_at = now()
        WHERE id = $1 AND used_at IS NULL
        RETURNING id
        `,
        [codeId]
      );
      return result.rowCount > 0;
    },

    async revokeAllRecoveryCodes(userId) {
      await db.query(
        `
        UPDATE user_recovery_codes
        SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [userId]
      );
    },

    /* =========================================================================
     * TRUSTED DEVICES
     * ====================================================================== */

    async insertTrustedDevice(client, data) {
      const result = await client.query(
        `
        INSERT INTO trusted_devices (
          user_id, device_token_hash, device_label, user_agent, ip_address, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.userId,
          data.deviceTokenHash,
          data.deviceLabel || null,
          data.userAgent || null,
          data.ipAddress || null,
          data.expiresAt,
        ]
      );
      return result.rows[0];
    },

    async findTrustedDeviceByTokenHash(tokenHash) {
      const result = await db.query(
        `
        SELECT * FROM trusted_devices
        WHERE device_token_hash = $1 AND revoked_at IS NULL
        LIMIT 1
        `,
        [tokenHash]
      );
      return result.rows[0] || null;
    },

    async listTrustedDevicesForUser(userId) {
      const result = await db.query(
        `
        SELECT * FROM trusted_devices
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
        ORDER BY last_seen_at DESC
        `,
        [userId]
      );
      return result.rows;
    },

    async touchTrustedDevice(deviceId) {
      await db.query(
        `UPDATE trusted_devices SET last_seen_at = now() WHERE id = $1`,
        [deviceId]
      );
    },

    async revokeTrustedDevice(deviceId, userId) {
      const result = await db.query(
        `
        UPDATE trusted_devices
        SET revoked_at = now()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        RETURNING id
        `,
        [deviceId, userId]
      );
      return result.rowCount > 0;
    },

    /* =========================================================================
     * SECURITY SETTINGS
     * ====================================================================== */

    async ensureSecuritySettings(userId, client = db) {
      await client.query(
        `
        INSERT INTO user_security_settings (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        `,
        [userId]
      );
    },

    async getSecuritySettings(userId) {
      const result = await db.query(
        `SELECT * FROM user_security_settings WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] || null;
    },

    async updateSecuritySettings(userId, fields) {
      const result = await db.query(
        `
        UPDATE user_security_settings
        SET mfa_enabled_at = COALESCE($2, mfa_enabled_at),
            mfa_secret_encrypted = COALESCE($3, mfa_secret_encrypted),
            mfa_secret_pending_encrypted = $4,
            mfa_recovery_codes_generated_at = COALESCE($5, mfa_recovery_codes_generated_at),
            password_changed_at = COALESCE($6, password_changed_at),
            security_settings_updated_at = now()
        WHERE user_id = $1
        RETURNING *
        `,
        [
          userId,
          fields.mfaEnabledAt || null,
          fields.mfaSecretEncrypted || null,
          fields.mfaSecretPendingEncrypted === undefined ? null : fields.mfaSecretPendingEncrypted,
          fields.mfaRecoveryCodesGeneratedAt || null,
          fields.passwordChangedAt || null,
        ]
      );
      return result.rows[0] || null;
    },

    /* =========================================================================
     * SECURITY EVENTS
     * ====================================================================== */

    async insertSecurityEvent(data) {
      const result = await db.query(
        `
        INSERT INTO user_security_events (
          user_id, event_type, outcome, ip_address, device_metadata, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          data.userId || null,
          data.eventType,
          data.outcome || 'success',
          data.ipAddress || null,
          data.deviceMetadata ? JSON.stringify(data.deviceMetadata) : null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );
      return result.rows[0];
    },

    async listSecurityEventsForUser(userId, { limit = 100, cursor = null } = {}) {
      const params = [userId, limit + 1];
      let cursorCondition = '';
      if (cursor) {
        params.push(cursor);
        cursorCondition = `AND occurred_at < $${params.length}`;
      }
      const result = await db.query(
        `
        SELECT * FROM user_security_events
        WHERE user_id = $1
          ${cursorCondition}
        ORDER BY occurred_at DESC
        LIMIT $2
        `,
        params
      );
      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const last = rows[rows.length - 1];
      return {
        rows,
        nextCursor: hasMore && last ? last.occurred_at.toISOString() : null,
      };
    },

    /* =========================================================================
     * AUTH METHODS
     * ====================================================================== */

    async insertAuthMethod(client, data) {
      const result = await client.query(
        `
        INSERT INTO user_auth_methods (user_id, method_type, identifier, status)
        VALUES ($1, $2, $3, 'active')
        RETURNING *
        `,
        [data.userId, data.methodType, data.identifier || null]
      );
      return result.rows[0];
    },

    async listAuthMethodsForUser(userId) {
      const result = await db.query(
        `
        SELECT * FROM user_auth_methods
        WHERE user_id = $1 AND status = 'active'
        ORDER BY created_at
        `,
        [userId]
      );
      return result.rows;
    },

    /* =========================================================================
     * NOTIFICATION PREFERENCES (Identity defaults)
     * ====================================================================== */

    async ensureDefaultNotificationPreferences(client, userId) {
      // Row per notification_type × channel where enabled=true
      const defaults = [
        ['security_alert', 'in_app'],
        ['security_alert', 'email'],
        ['login_success', 'in_app'],
        ['login_success', 'email'],
        ['password_change', 'email'],
        ['password_change', 'in_app'],
        ['mfa_change', 'email'],
        ['mfa_change', 'in_app'],
        ['session_revoked', 'in_app'],
      ];
      const values = [];
      const params = [];
      let idx = 1;
      for (const [type, channel] of defaults) {
        values.push(`($${idx++}, $${idx++}, $${idx++}, true)`);
        params.push(userId, type, channel);
      }
      await client.query(
        `
        INSERT INTO user_notification_preferences (user_id, notification_type, channel, enabled)
        VALUES ${values.join(', ')}
        ON CONFLICT (user_id, notification_type, channel) DO NOTHING
        `,
        params
      );
    },
  };
}

export default createIdentityQueries;
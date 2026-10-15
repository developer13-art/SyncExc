/**
 * SyncExc Server — Preferences service
 */

export function createPreferencesService({ db, queries, logger }) {
  async function getPreferences({ userId }) {
    const prefs = await queries.listPreferences(userId);
    const quietHours = await queries.getQuietHours(userId);
    return { preferences: prefs, quietHours };
  }

  async function setPreference({ userId, notificationType, channel, enabled }) {
    return db.tx(async (tx) => {
      return queries.upsertPreference(tx, {
        userId,
        notificationType,
        channel,
        enabled,
      });
    });
  }

  async function setQuietHours({ userId, enabled, startTime, endTime, timezone, daysOfWeek }) {
    return db.tx(async (tx) => {
      return queries.upsertQuietHours(tx, {
        userId,
        enabled,
        startTime,
        endTime,
        timezone,
        daysOfWeek,
      });
    });
  }

  /**
   * Determine whether a channel is permitted for a given category.
   *
   * Precedence (highest first):
   *   1. Mandatory platform / security policy
   *   2. Critical operational policy (risk, execution)
   *   3. Workspace policy
   *   4. User preference
   *   5. Quiet hours
   */
  async function shouldDeliver({ userId, workspaceId, category, notificationType, channel, priority }) {
    // 1. Security alerts cannot be disabled via preferences
    if (category === 'security') {
      return { allowed: true, reason: 'mandatory_security' };
    }

    // 2. Critical risk alerts cannot be disabled
    if (category === 'risk' && priority === 'critical') {
      return { allowed: true, reason: 'mandatory_critical_risk' };
    }

    // 3. Workspace policy
    if (workspaceId) {
      const policy = await queries.getWorkspacePolicy(workspaceId, category, channel);
      if (policy && policy.enabled === false) {
        // User can still receive mandatory categories
        if (category !== 'security' && priority !== 'critical') {
          return { allowed: false, reason: 'workspace_policy_disabled' };
        }
      }
    }

    // 4. User preference (if the specific event type is defined)
    const pref = await queries.getPreference(userId, notificationType, channel);
    if (pref && pref.enabled === false) {
      // Mandatory billing
      if (category === 'billing' && priority === 'high') {
        return { allowed: true, reason: 'mandatory_billing' };
      }
      return { allowed: false, reason: 'user_preference_disabled' };
    }

    // 5. Quiet hours — only delays non-critical external delivery
    if (channel !== 'in_app') {
      const quiet = await queries.getQuietHours(userId);
      if (quiet && quiet.enabled) {
        const isQuiet = isInQuietHours(quiet);
        if (isQuiet) {
          if (priority === 'critical' || priority === 'high') {
            return { allowed: true, reason: 'bypasses_quiet_hours' };
          }
          return { allowed: false, reason: 'quiet_hours' };
        }
      }
    }

    return { allowed: true, reason: 'allowed' };
  }

  function isInQuietHours(quiet) {
    if (!quiet.start_time || !quiet.end_time) return false;
    const now = new Date();
    const tz = quiet.timezone || 'UTC';

    // Get current time in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || '';

    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayOfWeek = weekdayMap[weekdayStr] ?? now.getUTCDay();

    if (!quiet.days_of_week.includes(dayOfWeek)) return false;

    const currentMinutes = hour * 60 + minute;
    const [startH, startM] = quiet.start_time.split(':').map(Number);
    const [endH, endM] = quiet.end_time.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight quiet hours (e.g. 22:00 → 08:00)
    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return {
    getPreferences,
    setPreference,
    setQuietHours,
    shouldDeliver,
  };
}

export default createPreferencesService;
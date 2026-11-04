/**
 * SyncExc Server — Admin console system service
 *
 * Read-only operational health for the infrastructure pages. Every query is
 * best-effort: a single failing subsystem is reported as degraded instead of
 * failing the whole overview.
 */

import { createLogger } from '../../../lib/logger.js';

const logger = createLogger({ component: 'admin-console-system' });

async function safeQuery(db, sql, params = [], fallback = null) {
  try {
    const result = await db.query(sql, params);
    return result;
  } catch (err) {
    logger.warn({ err, sql: sql.slice(0, 160) }, 'Admin system query failed');
    return fallback;
  }
}

function rowsOf(result) {
  return result?.rows || [];
}

export function createConsoleSystemService({ db, config, storage, events, realtime }) {
  async function databaseHealth() {
    let health = { ok: false, latencyMs: null, version: null };
    try {
      health = await db.health();
    } catch (err) {
      health = { ok: false, latencyMs: null, version: null, error: err.message };
    }

    const [size, migrations, tables] = await Promise.all([
      safeQuery(
        db,
        `SELECT pg_database_size(current_database())::bigint AS bytes,
                pg_size_pretty(pg_database_size(current_database())) AS pretty`,
      ),
      safeQuery(db, `SELECT count(*)::int AS applied FROM schema_migrations`),
      safeQuery(
        db,
        `SELECT count(*)::int AS total
           FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      ),
    ]);

    return {
      ok: Boolean(health.ok),
      latencyMs: health.latencyMs ?? null,
      version: health.version ?? null,
      error: health.error || null,
      sizeBytes: Number(rowsOf(size)[0]?.bytes || 0),
      sizePretty: rowsOf(size)[0]?.pretty || null,
      migrationsApplied: Number(rowsOf(migrations)[0]?.applied || 0),
      tables: Number(rowsOf(tables)[0]?.total || 0),
      pool: {
        total: db.pool?.totalCount ?? null,
        idle: db.pool?.idleCount ?? null,
        waiting: db.pool?.waitingCount ?? null,
      },
    };
  }

  async function jobHealth() {
    const [counts, failures, deadLetter] = await Promise.all([
      safeQuery(db, `SELECT status, count(*)::int AS count FROM jobs GROUP BY status`),
      safeQuery(
        db,
        `SELECT id, job_type, status, attempts, last_error, created_at
           FROM jobs
          WHERE status IN ('failed', 'dead_lettered')
          ORDER BY created_at DESC
          LIMIT 10`,
      ),
      safeQuery(
        db,
        `SELECT count(*)::int AS count FROM jobs WHERE dead_letter_at IS NOT NULL`,
      ),
    ]);

    const byStatus = Object.fromEntries(rowsOf(counts).map((row) => [row.status, row.count]));
    return {
      byStatus,
      total: Object.values(byStatus).reduce((sum, value) => sum + Number(value), 0),
      deadLettered: Number(rowsOf(deadLetter)[0]?.count || 0),
      recentFailures: rowsOf(failures),
    };
  }

  async function outboxHealth() {
    const [counts, oldest] = await Promise.all([
      safeQuery(db, `SELECT status, count(*)::int AS count FROM outbox_events GROUP BY status`),
      safeQuery(
        db,
        `SELECT extract(epoch FROM (now() - min(occurred_at)))::int AS age_seconds
           FROM outbox_events
          WHERE status = 'pending'`,
      ),
    ]);

    const byStatus = Object.fromEntries(rowsOf(counts).map((row) => [row.status, row.count]));
    return {
      byStatus,
      pending: Number(byStatus.pending || 0),
      failed: Number(byStatus.failed || 0),
      deadLettered: Number(byStatus.dead_lettered || 0),
      oldestPendingAgeSeconds: Number(rowsOf(oldest)[0]?.age_seconds || 0),
    };
  }

  async function exchangeHealth() {
    const [connections, incidents, metrics] = await Promise.all([
      safeQuery(
        db,
        `SELECT status, count(*)::int AS count
           FROM exchange_connections
          GROUP BY status`,
      ),
      safeQuery(
        db,
        `SELECT exchange_code, severity, title, started_at
           FROM exchange_adapter_incidents
          WHERE resolved_at IS NULL
          ORDER BY started_at DESC
          LIMIT 10`,
      ),
      safeQuery(
        db,
        `SELECT exchange_code,
                count(*)::int AS requests,
                count(*) FILTER (WHERE status_code >= 500)::int AS server_errors,
                round(avg(latency_ms))::int AS avg_latency_ms
           FROM exchange_request_metrics
          WHERE recorded_at >= now() - interval '24 hours'
          GROUP BY exchange_code
          ORDER BY requests DESC
          LIMIT 10`,
      ),
    ]);

    return {
      connectionsByStatus: Object.fromEntries(
        rowsOf(connections).map((row) => [row.status, row.count]),
      ),
      unresolvedIncidents: rowsOf(incidents),
      last24h: rowsOf(metrics),
    };
  }

  async function sourceHealth() {
    const [health, monitoring] = await Promise.all([
      safeQuery(
        db,
        `SELECT health_state, count(*)::int AS count
           FROM signal_sources
          GROUP BY health_state`,
      ),
      safeQuery(
        db,
        `SELECT count(*)::int AS started
           FROM signal_sources
          WHERE monitoring_enabled = true AND archived_at IS NULL`,
      ),
    ]);

    return {
      byHealthState: Object.fromEntries(rowsOf(health).map((row) => [row.health_state, row.count])),
      monitoring: Number(rowsOf(monitoring)[0]?.started || 0),
    };
  }

  async function deploymentHistory() {
    const result = await safeQuery(
      db,
      `SELECT id, version, environment, status, commit_ref, deployed_at, rolled_back_at
         FROM platform_deployments
        ORDER BY deployed_at DESC
        LIMIT 10`,
    );
    return rowsOf(result);
  }

  async function sessionHealth() {
    const result = await safeQuery(
      db,
      `SELECT
          count(*) FILTER (WHERE revoked_at IS NULL AND expires_at > now())::int AS active,
          count(*) FILTER (WHERE revoked_at IS NULL AND expires_at <= now())::int AS expired
         FROM user_sessions`,
    );
    return rowsOf(result)[0] || { active: 0, expired: 0 };
  }

  async function storageHealth() {
    if (!storage?.health) return { status: 'unknown' };
    try {
      return await storage.health();
    } catch (err) {
      return { status: 'error', reason: err.message };
    }
  }

  function subsystemStatus({ database, jobs, outbox, storageStatus }) {
    return [
      { key: 'database', label: 'Database', status: database.ok ? 'ok' : 'error', detail: database.latencyMs != null ? `${database.latencyMs}ms` : null },
      { key: 'jobs', label: 'Background jobs', status: jobs.deadLettered > 0 ? 'degraded' : 'ok', detail: jobs.deadLettered > 0 ? `${jobs.deadLettered} dead-lettered` : null },
      { key: 'outbox', label: 'Event outbox', status: outbox.failed > 0 || outbox.deadLettered > 0 ? 'degraded' : 'ok', detail: outbox.failed > 0 ? `${outbox.failed} failed` : null },
      { key: 'storage', label: 'Object storage', status: storageStatus.status === 'ok' ? 'ok' : 'unknown', detail: storageStatus.driver || null },
      { key: 'realtime', label: 'Realtime gateway', status: realtime ? 'ok' : 'unknown', detail: null },
      { key: 'events', label: 'Event bus', status: events ? 'ok' : 'unknown', detail: null },
    ];
  }

  async function overview() {
    const [database, jobs, outbox, exchanges, sources, deployments, sessions, storageStatus] =
      await Promise.all([
        databaseHealth(),
        jobHealth(),
        outboxHealth(),
        exchangeHealth(),
        sourceHealth(),
        deploymentHistory(),
        sessionHealth(),
        storageHealth(),
      ]);

    const warnings = [];
    if (!database.ok) warnings.push('Database health check is failing');
    if (jobs.deadLettered > 0) warnings.push(`${jobs.deadLettered} background job(s) are dead-lettered`);
    if (outbox.failed > 0) warnings.push(`${outbox.failed} outbox event(s) failed to publish`);
    if (exchanges.unresolvedIncidents.length > 0) warnings.push(`${exchanges.unresolvedIncidents.length} exchange incident(s) are unresolved`);
    if (storageStatus.status === 'error') warnings.push('Object storage health check failed');

    return {
      generatedAt: new Date().toISOString(),
      environment: config?.env || 'unknown',
      database,
      jobs,
      outbox,
      exchanges,
      sources,
      sessions,
      storage: storageStatus,
      deployments,
      subsystems: subsystemStatus({ database, jobs, outbox, storageStatus }),
      warnings,
    };
  }

  return { overview };
}

export default createConsoleSystemService;

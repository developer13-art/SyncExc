/**
 * SyncExc Server — Export service
 *
 * Generates authorized data exports. Every export is signed with a
 * short-lived download URL and audited.
 */

import { NotFoundError } from '../../lib/errors.js';

export function createExportService({ db, queries, storage, jobs, audit, logger }) {
  async function requestExport({ userId, resourceType, filters, reason }) {
    return db.tx(async (tx) => {
      const exportRecord = await queries.insertExport(tx, {
        userId,
        resourceType,
        filters,
      });

      await audit.write({
        actorId: userId,
        action: 'export.requested',
        targetResource: 'admin_export',
        targetId: exportRecord.id,
        after: { resourceType, filters, reason },
      });

      return exportRecord;
    }).then(async (exportRecord) => {
      // Enqueue the export job
      await jobs.enqueue('export_generator', {
        exportId: exportRecord.id,
      });
      return exportRecord;
    });
  }

  async function listExports({ userId, limit }) {
    return queries.listExports({ userId, limit });
  }

  async function getExport({ exportId, userId }) {
    const exportRecord = await queries.findExport(exportId);
    if (!exportRecord || exportRecord.user_id !== userId) {
      throw new NotFoundError('Export');
    }
    return exportRecord;
  }

  async function generate({ exportId }) {
    const exportRecord = await queries.findExport(exportId);
    if (!exportRecord) throw new NotFoundError('Export');

    await queries.updateExport(exportId, { status: 'processing' });

    try {
      const { columns, rows, fileName } = await runExport(exportRecord);
      const buffer = Buffer.from(rowsToCsv(columns, rows), 'utf8');

      const stored = await storage.put({
        buffer,
        mimeType: 'text/csv',
        extension: 'csv',
      });

      await queries.updateExport(exportId, {
        status: 'completed',
        storageKey: stored.key,
        rowCount: rows.length,
        completedAt: new Date(),
      });

      logger.info({ exportId, rowCount: rows.length }, 'Export completed');
      return { ok: true, rowCount: rows.length };
    } catch (err) {
      logger.error({ err, exportId }, 'Export generation failed');
      await queries.updateExport(exportId, {
        status: 'failed',
        errorMessage: err.message,
        completedAt: new Date(),
      });
      throw err;
    }
  }

  function rowsToCsv(columns, rows) {
    const header = columns.map(escapeCsvCell).join(',');
    const lines = [header];
    for (const row of rows) {
      lines.push(columns.map((col) => escapeCsvCell(row[col])).join(','));
    }
    return lines.join('\n');
  }

  function escapeCsvCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Formula injection protection
    const dangerous = ['=', '+', '-', '@', '\t', '\r'];
    const safe = dangerous.includes(str[0]) ? `'${str}` : str;
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  }

  async function runExport(exportRecord) {
    switch (exportRecord.resource_type) {
      case 'audit_events': {
        const result = await db.query(
          `
          SELECT id, actor_id, action, target_resource, target_id, outcome, occurred_at
          FROM admin_audit_events
          WHERE occurred_at >= $1
          ORDER BY occurred_at DESC
          LIMIT 100000
          `,
          [exportRecord.filters?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]
        );
        return {
          columns: ['id', 'actor_id', 'action', 'target_resource', 'target_id', 'outcome', 'occurred_at'],
          rows: result.rows,
          fileName: 'audit-events.csv',
        };
      }
      case 'users': {
        const result = await db.query(
          `SELECT id, email, username, status, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100000`
        );
        return {
          columns: ['id', 'email', 'username', 'status', 'created_at'],
          rows: result.rows,
          fileName: 'users.csv',
        };
      }
      case 'payments': {
        const result = await db.query(
          `
          SELECT id, subscription_id, provider, amount_minor, currency, status, created_at
          FROM subscription_payments
          ORDER BY created_at DESC
          LIMIT 100000
          `
        );
        return {
          columns: ['id', 'subscription_id', 'provider', 'amount_minor', 'currency', 'status', 'created_at'],
          rows: result.rows,
          fileName: 'payments.csv',
        };
      }
      default:
        throw new Error(`Unsupported export resource: ${exportRecord.resource_type}`);
    }
  }

  async function getDownloadUrl({ exportId, userId }) {
    const exportRecord = await queries.findExport(exportId);
    if (!exportRecord || exportRecord.user_id !== userId) {
      throw new NotFoundError('Export');
    }
    if (exportRecord.status !== 'completed' || !exportRecord.storage_key) {
      throw new NotFoundError('File not ready');
    }

    // Update downloaded_at
    await queries.updateExport(exportId, {
      downloadedAt: new Date(),
    });

    // Signed URL via storage driver
    const signedUrl = await storage.signedUrl(exportRecord.storage_key, 900);
    if (signedUrl) return { url: signedUrl };

    // Local driver: return the storage key for streaming via an authenticated route
    return { storageKey: exportRecord.storage_key };
  }

  return {
    requestExport,
    listExports,
    getExport,
    generate,
    getDownloadUrl,
  };
}

export default createExportService;
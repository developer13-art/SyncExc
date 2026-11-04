/**
 * SyncExc Server — Admin console query service
 *
 * Executes list, detail, summary and export queries strictly through the
 * allow-listed resource registry. All values are parameterized; identifiers
 * only ever come from registry descriptors.
 */

import { AppError, NotFoundError, ValidationError } from '../../../lib/errors.js';
import { getResource } from './registry.js';

const MAX_PAGE_SIZE = 200;
const MAX_EXPORT_ROWS = 5000;
const SPECIAL_PRESETS = {
  entryType: { column: 'a.entry_type' },
  operationType: { column: 'a.operation_type' },
  adapter: { column: 'a.adapter_type' },
  target_resource: { column: 'a.target_resource' },
  featured: { column: 'a.is_featured' },
};

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function maskRow(resource, row) {
  if (resource.key !== 'platform-settings') return row;
  if (row.is_sensitive) {
    return { ...row, value: { masked: true }, is_sensitive: true };
  }
  return row;
}

function buildWhere(resource, { filters = {}, search, preset = null, from, to }) {
  const clauses = [];
  const values = [];

  const push = (sql, value) => {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  };

  const filterMap = new Map(resource.filters.map((filter) => [filter.key, filter]));
  const columnKeys = new Set(resource.columns.map((column) => column.key));

  const applyCondition = (key, value) => {
    if (value === undefined || value === null || value === '') return;
    const filter = filterMap.get(key);
    const column = filter?.column || SPECIAL_PRESETS[key]?.column || (columnKeys.has(key) ? `a.${key}` : null);
    if (!column) return;

    if (Array.isArray(value)) {
      if (value.length === 0) return;
      const placeholders = value.map((entry) => {
        values.push(entry);
        return `$${values.length}`;
      });
      clauses.push(`${column} IN (${placeholders.join(', ')})`);
      return;
    }
    if (typeof value === 'boolean') {
      clauses.push(`${column} = ${value ? 'true' : 'false'}`);
      return;
    }
    push(`${column} = ?`, value);
  };

  for (const [key, value] of Object.entries(filters || {})) {
    applyCondition(key, value);
  }

  for (const [key, value] of Object.entries(preset || {})) {
    if (key === 'error') {
      if (resource.key === 'developer-request-logs') {
        clauses.push('(a.status >= 400 OR a.error_code IS NOT NULL)');
      } else {
        clauses.push('(a.status_code >= 400 OR a.error_class IS NOT NULL)');
      }
      continue;
    }
    if (key === 'hasError') {
      clauses.push('a.error_message IS NOT NULL');
      continue;
    }
    applyCondition(key, value);
  }

  if (search) {
    const term = String(search).trim().slice(0, 200);
    if (term && resource.search.length > 0) {
      values.push(`%${term}%`);
      const placeholder = `$${values.length}`;
      clauses.push(`(${resource.search.map((column) => `${column}::text ILIKE ${placeholder}`).join(' OR ')})`);
    }
  }

  if (resource.dateColumn) {
    if (from) {
      const parsed = new Date(from);
      if (!Number.isNaN(parsed.getTime())) push(`${resource.dateColumn} >= ?`, parsed.toISOString());
    }
    if (to) {
      const parsed = new Date(to);
      if (!Number.isNaN(parsed.getTime())) push(`${resource.dateColumn} <= ?`, parsed.toISOString());
    }
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

function selectList(resource) {
  return [`${resource.idColumn} AS id`, ...resource.columns.map((column) => `${column.select} AS "${column.key}"`)].join(', ');
}

function resolveSort(resource, sort, direction) {
  const requested = String(sort || '').trim();
  const column = resource.columns.find((entry) => entry.key === requested);
  const expression = column?.select || resource.defaultSort || resource.dateColumn || 'a.id';
  const dir = String(direction || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${expression} ${dir}`;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createConsoleQueryService({ db }) {
  async function list({
    resourceKey,
    filters = {},
    search,
    page = 1,
    pageSize = 50,
    sort,
    direction,
    preset = null,
    from,
    to,
  }) {
    const resource = getResource(resourceKey);
    if (!resource) throw new NotFoundError('Admin resource');

    const limit = clampInt(pageSize, 50, 1, MAX_PAGE_SIZE);
    const currentPage = clampInt(page, 1, 1, 100000);
    const offset = (currentPage - 1) * limit;
    const where = buildWhere(resource, { filters, search, preset, from, to });

    const totalResult = await db.query(
      `SELECT count(*)::int AS total FROM ${resource.from} ${where.sql}`,
      where.values,
    );
    const values = [...where.values, limit, offset];
    const rows = await db.query(
      `SELECT ${selectList(resource)}
         FROM ${resource.from}
         ${where.sql}
        ORDER BY ${resolveSort(resource, sort, direction)}
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return {
      items: rows.rows.map((row) => maskRow(resource, row)),
      total: totalResult.rows[0]?.total || 0,
      page: currentPage,
      pageSize: limit,
    };
  }

  async function detail({ resourceKey, id }) {
    const resource = getResource(resourceKey);
    if (!resource) throw new NotFoundError('Admin resource');
    if (!id) throw new ValidationError('Record id is required');

    const result = await db.query(
      `SELECT ${selectList(resource)} FROM ${resource.from} WHERE ${resource.idColumn} = $1 LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) throw new NotFoundError('Record');

    const [notes, audit] = await Promise.all([
      db.query(
        `SELECT n.id, n.note, n.created_at, u.email AS author_email
           FROM admin_internal_notes n
           LEFT JOIN users u ON u.id = n.created_by
          WHERE n.resource_type = $1 AND n.resource_id = $2 AND n.deleted_at IS NULL
          ORDER BY n.created_at DESC
          LIMIT 50`,
        [resource.key, id],
      ),
      db.query(
        `SELECT id, action, target_resource, target_id, reason, outcome, occurred_at, actor_id
           FROM admin_audit_events
          WHERE target_id = $1
          ORDER BY occurred_at DESC
          LIMIT 25`,
        [id],
      ),
    ]);

    return {
      record: maskRow(resource, result.rows[0]),
      notes: notes.rows,
      audit: audit.rows,
    };
  }

  async function summary({ resourceKey, filters = {}, preset = null, from, to }) {
    const resource = getResource(resourceKey);
    if (!resource) throw new NotFoundError('Admin resource');

    const where = buildWhere(resource, { filters, preset, from, to });
    const metrics = resource.summary || [];

    let cards = [];
    if (metrics.length > 0) {
      const result = await db.query(
        `SELECT ${metrics.map((metric) => `${metric.expr} AS "${metric.key}"`).join(', ')}
           FROM ${resource.from} ${where.sql}`,
        where.values,
      );
      cards = metrics.map((metric) => ({
        key: metric.key,
        label: metric.label,
        value: result.rows[0]?.[metric.key] ?? 0,
      }));
    }

    let trend = [];
    if (resource.dateColumn) {
      const trendResult = await db.query(
        `SELECT to_char(date_trunc('day', ${resource.dateColumn}), 'YYYY-MM-DD') AS day, count(*)::int AS count
           FROM ${resource.from}
           ${where.sql ? `${where.sql} AND` : 'WHERE'} ${resource.dateColumn} >= now() - interval '30 days'
          GROUP BY 1
          ORDER BY 1`,
        where.values,
      );
      trend = trendResult.rows;
    }

    return { cards, trend };
  }

  async function exportCsv({ resourceKey, filters = {}, search, preset = null, from, to }) {
    const resource = getResource(resourceKey);
    if (!resource) throw new NotFoundError('Admin resource');

    const where = buildWhere(resource, { filters, search, preset, from, to });
    const rows = await db.query(
      `SELECT ${selectList(resource)}
         FROM ${resource.from}
         ${where.sql}
        ORDER BY ${resolveSort(resource, null, 'desc')}
        LIMIT ${MAX_EXPORT_ROWS}`,
      where.values,
    );

    const header = resource.columns.map((column) => csvEscape(column.label)).join(',');
    const lines = rows.rows.map((row) =>
      resource.columns.map((column) => csvEscape(maskRow(resource, row)[column.key])).join(','),
    );

    return {
      filename: `${resource.key}-${new Date().toISOString().slice(0, 10)}.csv`,
      content: [header, ...lines].join('\n'),
      rowCount: rows.rowCount,
    };
  }

  async function resolveRecord(resourceKey, id) {
    const resource = getResource(resourceKey);
    if (!resource) throw new AppError('Unknown resource', { status: 404, code: 'RESOURCE_NOT_FOUND' });
    const result = await db.query(
      `SELECT ${selectList(resource)} FROM ${resource.from} WHERE ${resource.idColumn} = $1 LIMIT 1`,
      [id],
    );
    if (result.rowCount === 0) throw new NotFoundError('Record');
    return { resource, record: result.rows[0] };
  }

  return { list, detail, summary, exportCsv, resolveRecord };
}

export default createConsoleQueryService;

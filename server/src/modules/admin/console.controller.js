/**
 * SyncExc Server — Admin console controller
 *
 * Serves every catalog page from the resource registry. Handlers never touch
 * SQL directly; they delegate to the console query, action, system and
 * analytics services.
 */

import { success } from '../../lib/response.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { listResources, resolvePage } from './console/registry.js';

const RESERVED_QUERY_KEYS = new Set([
  'page',
  'pageSize',
  'sort',
  'direction',
  'search',
  'from',
  'to',
  'filters',
  'preset',
]);

function parseFilters(query) {
  const filters = {};

  if (query.filters !== undefined) {
    if (typeof query.filters === 'string') {
      try {
        Object.assign(filters, JSON.parse(query.filters));
      } catch {
        throw new ValidationError('filters must be valid JSON');
      }
    } else if (query.filters && typeof query.filters === 'object') {
      Object.assign(filters, query.filters);
    }
  }

  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.has(key) || key.startsWith('_')) continue;
    filters[key] = value;
  }

  return filters;
}

function parsePreset(query) {
  if (query.preset === undefined) return null;
  if (typeof query.preset === 'object') return query.preset;
  try {
    const parsed = JSON.parse(query.preset);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    throw new ValidationError('preset must be valid JSON');
  }
}

export function createConsoleController({ query, action, system, analytics, permission }) {
  async function getPage(req, res) {
    const { sectionId, pageId } = req.params;
    const page = resolvePage(sectionId, pageId);
    if (!page) throw new NotFoundError('Admin page');

    const canManage = page.resource
      ? await permission.has(req.auth.userId, page.resource.managePermission)
      : false;

    return success(res, {
      ...page,
      permissions: { view: true, manage: canManage },
    });
  }

  async function listResourceDefinitions(req, res) {
    const { permissions } = await permission.getEffectivePermissions(req.auth.userId);
    const canSeeAll = permissions.has('*');
    const items = listResources().filter(
      (resource) => canSeeAll || permissions.has(resource.viewPermission),
    );
    return success(res, { items });
  }

  async function list(req, res) {
    const result = await query.list({
      resourceKey: req.params.resourceKey,
      filters: parseFilters(req.query),
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize,
      sort: req.query.sort,
      direction: req.query.direction,
      preset: parsePreset(req.query),
      from: req.query.from,
      to: req.query.to,
    });
    return success(res, result, {
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  }

  async function detail(req, res) {
    const result = await query.detail({
      resourceKey: req.params.resourceKey,
      id: req.params.id,
    });
    return success(res, result);
  }

  async function summary(req, res) {
    const result = await query.summary({
      resourceKey: req.params.resourceKey,
      filters: parseFilters(req.query),
      preset: parsePreset(req.query),
      from: req.query.from,
      to: req.query.to,
    });
    return success(res, result);
  }

  async function exportCsv(req, res) {
    const result = await query.exportCsv({
      resourceKey: req.params.resourceKey,
      filters: parseFilters(req.query),
      search: req.query.search,
      preset: parsePreset(req.query),
      from: req.query.from,
      to: req.query.to,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.content);
  }

  async function performAction(req, res) {
    const result = await action.perform({
      resourceKey: req.params.resourceKey,
      actionKey: req.params.actionKey,
      recordId: req.params.id || null,
      body: req.body || {},
      actorId: req.auth.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return success(res, { result });
  }

  async function addNote(req, res) {
    const result = await action.addNote({
      resourceKey: req.params.resourceKey,
      recordId: req.params.id,
      note: req.body?.note,
      actorId: req.auth.userId,
    });
    return success(res, { note: result });
  }

  async function getSystem(req, res) {
    return success(res, await system.overview());
  }

  async function getAnalytics(req, res) {
    const sectionId = req.query.sectionId || req.params.sectionId || 'dashboard';
    return success(
      res,
      await analytics.overview({ sectionId, days: req.query.days }),
    );
  }

  return {
    getPage,
    listResourceDefinitions,
    list,
    detail,
    summary,
    exportCsv,
    performAction,
    addNote,
    getSystem,
    getAnalytics,
  };
}

export default createConsoleController;

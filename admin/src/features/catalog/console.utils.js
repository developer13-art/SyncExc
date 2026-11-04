import { ADMIN_SECTIONS } from '../../config/admin-navigation.js';

export function humanize(value) {
  if (!value) return '';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const SUCCESS_STATUSES = new Set([
  'active',
  'approved',
  'completed',
  'connected',
  'delivered',
  'enabled',
  'healthy',
  'paid',
  'published',
  'resolved',
  'settled',
  'signed',
  'success',
  'succeeded',
  'valid',
  'verified',
]);

const WARNING_STATUSES = new Set([
  'accumulated',
  'acknowledged',
  'assigned',
  'degraded',
  'draft',
  'held',
  'in_progress',
  'new',
  'paused',
  'pending',
  'pending_review',
  'processing',
  'provisioning',
  'scheduled',
  'under_review',
  'unknown',
  'waiting_for_customer',
  'waiting_for_internal_team',
]);

const DANGER_STATUSES = new Set([
  'canceled',
  'cancelled',
  'critical',
  'dead_lettered',
  'degraded_error',
  'disabled',
  'error',
  'expired',
  'failed',
  'invalid',
  'rejected',
  'revoked',
  'reversed',
  'suspended',
  'terminated',
]);

export function statusVariant(value) {
  const status = String(value ?? '').toLowerCase();
  if (SUCCESS_STATUSES.has(status)) return 'success';
  if (DANGER_STATUSES.has(status)) return 'destructive';
  if (WARNING_STATUSES.has(status)) return 'warning';
  if (status === 'open' || status === 'investigating' || status === 'escalated') return 'info';
  return 'muted';
}

export function isMoneySummaryKey(key) {
  return /(amount|net|credit|debit|revenue|fee|gross|refund)/i.test(key);
}

export function formatSummaryValue(key, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? '—');
  if (isMoneySummaryKey(key)) {
    return (numeric / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  }
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function recordLabel(record, columns = []) {
  if (!record) return 'Record';
  const preferred = columns.find(
    (column) => column.kind === 'text' && record[column.key] !== null && record[column.key] !== undefined && record[column.key] !== '',
  );
  if (preferred) return String(record[preferred.key]);
  if (record.id) return `Record ${String(record.id).slice(0, 8)}`;
  return 'Record';
}

export function buildQueryParams({
  search,
  filters = {},
  preset = null,
  from,
  to,
  page,
  pageSize,
  sort,
  direction,
} = {}) {
  const params = {};
  if (page) params.page = page;
  if (pageSize) params.pageSize = pageSize;
  if (search) params.search = search;
  if (sort) params.sort = sort;
  if (direction) params.direction = direction;
  if (from) params.from = from;
  if (to) params.to = to;
  if (preset && Object.keys(preset).length > 0) params.preset = JSON.stringify(preset);
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params[key] = value;
  }
  return params;
}

export function findDefaultListPage(sectionId, excludePageId) {
  const section = ADMIN_SECTIONS.find((entry) => entry.id === sectionId);
  if (!section) return null;
  const candidates = section.items.filter(
    (item) => item.id !== excludePageId && item.path.startsWith(`/catalog/${sectionId}/`),
  );
  return (
    candidates.find((item) => item.id.startsWith('all-'))
    || candidates.find((item) => item.path === `/catalog/${sectionId}/${item.id}` && item.id.includes('list'))
    || candidates[0]
    || section.items.find((item) => item.id !== excludePageId)
    || section.items[0]
    || null
  );
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function parseJsonInput(value, label) {
  if (value === undefined || value === null || value === '') return null;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

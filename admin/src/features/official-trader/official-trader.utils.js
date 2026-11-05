import { formatNumber, formatQuantity } from '../../lib/formatters/number.formatter.js';

const STATUS_VARIANTS = {
  enabled: 'success',
  active: 'success',
  published: 'success',
  executed: 'success',
  filled: 'success',
  reconciled: 'success',
  win: 'success',
  validated: 'info',
  generated: 'info',
  research_only: 'muted',
  paused: 'warning',
  suspended: 'destructive',
  rejected: 'destructive',
  failed: 'destructive',
  canceled: 'destructive',
  uncertain: 'warning',
  awaiting_confirmation: 'warning',
  execution_pending: 'warning',
  partially_filled: 'warning',
  partially_executed: 'warning',
  submitted: 'info',
  pending: 'muted',
  closed: 'muted',
  expired: 'muted',
  superseded: 'muted',
  breakeven: 'muted',
  loss: 'destructive',
};

export function statusVariant(status) {
  return STATUS_VARIANTS[status] ?? 'outline';
}

export function humanize(value) {
  if (value == null || value === '') return '—';
  return String(value).replace(/_/g, ' ');
}

export function formatMoney(value, decimals = 2) {
  if (value == null || value === '') return '—';
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(decimals, 2),
  });
}

export function formatPrice(value) {
  if (value == null || value === '') return '—';
  return formatQuantity(value, 8);
}

export function formatPercentValue(value, decimals = 2) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatConfidence(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(0)}%`;
}

export function formatList(values) {
  if (!Array.isArray(values) || values.length === 0) return '—';
  return values.map((value) => humanize(value)).join(', ');
}

export function defaultLimits(assignment) {
  return assignment?.limits ?? {};
}

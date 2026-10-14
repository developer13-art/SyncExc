import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
} from 'date-fns';

function coerceDate(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  if (typeof value === 'string') {
    const iso = parseISO(value);
    if (isValid(iso)) {
      return iso;
    }
    const d = new Date(value);
    return isValid(d) ? d : null;
  }
  return null;
}

export function formatDate(value, pattern = 'MMM d, yyyy') {
  const d = coerceDate(value);
  return d ? format(d, pattern) : '—';
}

export function formatDateTime(value, pattern = 'MMM d, yyyy HH:mm') {
  const d = coerceDate(value);
  return d ? format(d, pattern) : '—';
}

export function formatDateTimeWithSeconds(value) {
  return formatDateTime(value, 'MMM d, yyyy HH:mm:ss');
}

export function formatTime(value, pattern = 'HH:mm:ss') {
  const d = coerceDate(value);
  return d ? format(d, pattern) : '—';
}

export function formatUtc(value, pattern = 'yyyy-MM-dd HH:mm:ss \'UTC\'') {
  const d = coerceDate(value);
  return d ? format(d, pattern) : '—';
}

export function formatRelativeTime(value, options = {}) {
  const d = coerceDate(value);
  if (!d) {
    return '—';
  }
  const { addSuffix = true } = options;
  return formatDistanceToNow(d, { addSuffix });
}

export function formatDuration(startValue, endValue = new Date()) {
  const start = coerceDate(startValue);
  const end = coerceDate(endValue);
  if (!start || !end) {
    return '—';
  }

  const seconds = Math.abs(differenceInSeconds(end, start));
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatMilliseconds(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    return '—';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return formatDuration(new Date(Date.now() - ms));
}

export function isStale(value, maxAgeSeconds) {
  const d = coerceDate(value);
  if (!d) {
    return true;
  }
  return differenceInSeconds(new Date(), d) > maxAgeSeconds;
}

export function humanizeAge(value) {
  const d = coerceDate(value);
  if (!d) {
    return 'unknown';
  }
  const diff = differenceInSeconds(new Date(), d);
  if (diff < 5) {
    return 'just now';
  }
  if (diff < 60) {
    return `${diff}s ago`;
  }
  const minutes = differenceInMinutes(new Date(), d);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = differenceInHours(new Date(), d);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = differenceInDays(new Date(), d);
  return `${days}d ago`;
}

export function toISOString(value) {
  const d = coerceDate(value);
  return d ? d.toISOString() : null;
}
function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatNumber(value, options = {}) {
  const { minimumFractionDigits = 0, maximumFractionDigits = 6, compact = false } = options;
  const numeric = toNumber(value);
  if (numeric === null) {
    return '—';
  }
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
    notation: compact ? 'compact' : 'standard',
  });
}

export function formatCompact(value, options = {}) {
  return formatNumber(value, { ...options, compact: true });
}

export function formatInteger(value) {
  return formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatQuantity(value, precision = 8) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return '—';
  }
  const trimmed = numeric.toFixed(precision).replace(/\.?0+$/, '');
  return trimmed.length === 0 ? '0' : trimmed;
}

export function formatFileSize(bytes) {
  const numeric = toNumber(bytes);
  if (numeric === null) {
    return '—';
  }
  if (numeric === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.floor(Math.log(numeric) / Math.log(1024));
  const value = numeric / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatDurationMs(ms) {
  const numeric = toNumber(ms);
  if (numeric === null) {
    return '—';
  }
  if (numeric < 1000) {
    return `${Math.round(numeric)}ms`;
  }
  if (numeric < 60_000) {
    return `${(numeric / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(numeric / 60_000);
  const seconds = Math.floor((numeric % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function abbreviateNumber(value, precision = 2) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return '—';
  }
  const abs = Math.abs(numeric);
  if (abs >= 1e12) {
    return `${(numeric / 1e12).toFixed(precision)}T`;
  }
  if (abs >= 1e9) {
    return `${(numeric / 1e9).toFixed(precision)}B`;
  }
  if (abs >= 1e6) {
    return `${(numeric / 1e6).toFixed(precision)}M`;
  }
  if (abs >= 1e3) {
    return `${(numeric / 1e3).toFixed(precision)}K`;
  }
  return numeric.toFixed(precision);
}
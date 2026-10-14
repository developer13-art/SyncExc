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

export function formatPercent(value, options = {}) {
  const { decimals = 2, showSign = false, already100 = false } = options;
  const numeric = toNumber(value);
  if (numeric === null) {
    return '—';
  }
  const scaled = already100 ? numeric : numeric * 100;
  const sign = showSign && scaled > 0 ? '+' : '';
  return `${sign}${scaled.toFixed(decimals)}%`;
}

export function formatPercentChange(current, previous, options = {}) {
  const { decimals = 2 } = options;
  const currentNumeric = toNumber(current);
  const previousNumeric = toNumber(previous);
  if (currentNumeric === null || previousNumeric === null || previousNumeric === 0) {
    return '—';
  }
  const change = ((currentNumeric - previousNumeric) / previousNumeric) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(decimals)}%`;
}

export function formatBasisPoints(value, options = {}) {
  const { decimals = 1, showSign = false } = options;
  const numeric = toNumber(value);
  if (numeric === null) {
    return '—';
  }
  const sign = showSign && numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(decimals)} bps`;
}

export function percentColorClass(value, { neutral = 'text-muted-foreground' } = {}) {
  const numeric = toNumber(value);
  if (numeric === null || numeric === 0) {
    return neutral;
  }
  return numeric > 0 ? 'text-success' : 'text-destructive';
}
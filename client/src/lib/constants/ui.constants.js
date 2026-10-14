export const STATUS_COLORS = Object.freeze({
  active: 'success',
  enabled: 'success',
  healthy: 'success',
  completed: 'success',
  filled: 'success',
  succeeded: 'success',
  verified: 'success',
  approved: 'success',

  pending: 'warning',
  processing: 'warning',
  validating: 'warning',
  awaiting_approval: 'warning',
  confirm_required: 'warning',
  partially_filled: 'warning',
  degraded: 'warning',
  stale: 'warning',
  review_required: 'warning',

  failed: 'destructive',
  error: 'destructive',
  rejected: 'destructive',
  blocked: 'destructive',
  suspended: 'destructive',
  revoked: 'destructive',
  cancelled: 'destructive',
  expired: 'destructive',
  critical: 'destructive',

  inactive: 'muted',
  archived: 'muted',
  disabled: 'muted',
  draft: 'muted',
  paused: 'muted',
  closed: 'muted',
  unknown: 'muted',
});

export const SEVERITY_COLORS = Object.freeze({
  critical: 'destructive',
  high: 'destructive',
  warning: 'warning',
  info: 'info',
  low: 'muted',
});

export const PRIORITY_COLORS = Object.freeze({
  urgent: 'destructive',
  critical: 'destructive',
  high: 'warning',
  normal: 'info',
  low: 'muted',
});

export const CHART_COLORS = Object.freeze([
  'hsl(221, 83%, 53%)',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(280, 65%, 60%)',
  'hsl(199, 89%, 48%)',
  'hsl(339, 82%, 59%)',
  'hsl(173, 80%, 40%)',
]);

export const ICON_SIZES = Object.freeze({
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
});

export const DENSITY_OPTIONS = Object.freeze([
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
]);
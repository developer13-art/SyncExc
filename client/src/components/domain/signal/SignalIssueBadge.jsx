import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

import { cn } from '../../../lib/utils/cn.util.js';

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  high: {
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  info: {
    icon: Info,
    className: 'border-info/30 bg-info/10 text-info',
  },
};

const ISSUE_LABELS = {
  missing_stop_loss: 'Missing stop-loss',
  missing_entry: 'Missing entry',
  missing_targets: 'Missing targets',
  missing_leverage: 'Leverage not stated',
  ambiguous_entry: 'Ambiguous entry',
  ambiguous_target: 'Ambiguous target',
  contradictory_values: 'Contradictory values',
  invalid_instrument: 'Invalid instrument',
  unsupported_instrument: 'Unsupported instrument',
  stale_signal: 'Stale signal',
  expired_signal: 'Expired signal',
  invalid_number: 'Invalid number',
  invalid_direction: 'Invalid direction',
};

export function SignalIssueBadge({ type, severity = 'warning', label, className }) {
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.warning;
  const Icon = config.icon;
  const displayLabel = label ?? ISSUE_LABELS[type] ?? type;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium',
        config.className,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{displayLabel}</span>
    </span>
  );
}
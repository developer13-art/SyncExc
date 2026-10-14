import { AlertTriangle, CheckCircle2, WifiOff, Clock } from 'lucide-react';

import { cn } from '../../../lib/utils/cn.util.js';

const HEALTH_CONFIG = {
  healthy: {
    label: 'Healthy',
    icon: CheckCircle2,
    className: 'text-success border-success/30 bg-success/5',
  },
  degraded: {
    label: 'Degraded',
    icon: AlertTriangle,
    className: 'text-warning border-warning/30 bg-warning/5',
  },
  stale: {
    label: 'Stale',
    icon: Clock,
    className: 'text-warning border-warning/30 bg-warning/5',
  },
  disconnected: {
    label: 'Disconnected',
    icon: WifiOff,
    className: 'text-destructive border-destructive/30 bg-destructive/5',
  },
  authorization_required: {
    label: 'Reauth',
    icon: WifiOff,
    className: 'text-warning border-warning/30 bg-warning/5',
  },
  rate_limited: {
    label: 'Rate Limited',
    icon: AlertTriangle,
    className: 'text-warning border-warning/30 bg-warning/5',
  },
  disabled: {
    label: 'Disabled',
    icon: WifiOff,
    className: 'text-muted-foreground border-border bg-muted/30',
  },
};

export function SourceHealthBadge({ status, className }) {
  const config =
    HEALTH_CONFIG[status] ?? {
      label: status ?? 'Unknown',
      icon: Clock,
      className: 'text-muted-foreground border-border bg-muted/30',
    };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium',
        config.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
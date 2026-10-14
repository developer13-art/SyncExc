import { Activity, Wifi, WifiOff } from 'lucide-react';

import { cn } from '../../../lib/utils/cn.util.js';

const HEALTH_CONFIG = {
  healthy: { label: 'Healthy', icon: Activity, className: 'text-success border-success/30 bg-success/5' },
  degraded: { label: 'Degraded', icon: Wifi, className: 'text-warning border-warning/30 bg-warning/5' },
  stale: { label: 'Stale', icon: Wifi, className: 'text-warning border-warning/30 bg-warning/5' },
  unavailable: { label: 'Unavailable', icon: WifiOff, className: 'text-destructive border-destructive/30 bg-destructive/5' },
  reauth_required: { label: 'Reauth', icon: WifiOff, className: 'text-warning border-warning/30 bg-warning/5' },
  suspended: { label: 'Suspended', icon: WifiOff, className: 'text-destructive border-destructive/30 bg-destructive/5' },
};

export function ConnectionHealthBadge({ status, className }) {
  const config = HEALTH_CONFIG[status] ?? { label: status ?? 'Unknown', icon: Wifi, className: 'text-muted-foreground border-border bg-muted/30' };
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
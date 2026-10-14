import { AlertCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

import { cn } from '../lib/utils/cn.util.js';

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: ShieldAlert,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  high: {
    label: 'High',
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  info: {
    label: 'Info',
    icon: Info,
    className: 'border-info/30 bg-info/10 text-info',
  },
  low: {
    label: 'Low',
    icon: Info,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

export function SeverityBadge({ severity, className, showIcon = true }) {
  if (!severity) {
    return null;
  }
  const config = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium',
        config.className,
        className,
      )}
    >
      {showIcon ? <Icon className="h-3 w-3 shrink-0" /> : null}
      {config.label}
    </span>
  );
}
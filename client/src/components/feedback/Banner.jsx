import { X, Info, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';

import { IconButton } from '../ui/IconButton.jsx';
import { cn } from '../../lib/utils/cn.util.js';

const VARIANTS = {
  info: { icon: Info, className: 'border-info/30 bg-info/5 text-info' },
  success: { icon: CheckCircle2, className: 'border-success/30 bg-success/5 text-success' },
  warning: { icon: AlertTriangle, className: 'border-warning/30 bg-warning/5 text-warning' },
  destructive: {
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/5 text-destructive',
  },
};

export function Banner({
  variant = 'info',
  title,
  description,
  action,
  dismissible = false,
  onDismiss,
  className,
}) {
  const [dismissed, setDismissed] = useState(false);
  const config = VARIANTS[variant] ?? VARIANTS.info;
  const Icon = config.icon;

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b px-4 py-3',
        config.className,
        className,
      )}
      role="status"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
        {description ? (
          <p className={cn('text-xs text-muted-foreground', title && 'mt-0.5')}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {dismissible ? (
        <IconButton label="Dismiss" size="sm" onClick={handleDismiss}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      ) : null}
    </div>
  );
}
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';

const VARIANTS = {
  info: {
    container: 'border-info/30 bg-info/5 text-info',
    icon: Info,
  },
  success: {
    container: 'border-success/30 bg-success/5 text-success',
    icon: CheckCircle2,
  },
  warning: {
    container: 'border-warning/30 bg-warning/5 text-warning',
    icon: AlertTriangle,
  },
  destructive: {
    container: 'border-destructive/30 bg-destructive/5 text-destructive',
    icon: AlertCircle,
  },
};

export function Alert({ variant = 'info', title, description, action, children, className }) {
  const config = VARIANTS[variant] ?? VARIANTS.info;
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-sm',
        config.container,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        {title ? <p className="font-medium text-foreground">{title}</p> : null}
        {description ? (
          <p className={cn('text-sm text-muted-foreground', title && 'mt-1')}>{description}</p>
        ) : null}
        {children ? <div className={cn(title || description ? 'mt-2' : '')}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
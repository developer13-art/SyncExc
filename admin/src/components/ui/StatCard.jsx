import { cn } from '../../lib/utils/cn.util.js';

export function StatCard({ label, value, hint, icon: Icon, trend, tone, className }) {
  const toneClasses = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              'mt-2 text-2xl font-semibold tracking-tight',
              toneClasses[tone ?? 'default'],
            )}
          >
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {trend ? (
        <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          {trend}
        </div>
      ) : null}
    </div>
  );
}
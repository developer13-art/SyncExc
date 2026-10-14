import { cn } from '../../lib/utils/cn.util.js';

export function MetricCard({ title, value, unit, subtitle, sparkline, className }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 shadow-sm', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-xl font-semibold text-foreground">{value}</span>
        {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
      </div>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      {sparkline ? <div className="mt-3 h-10">{sparkline}</div> : null}
    </div>
  );
}
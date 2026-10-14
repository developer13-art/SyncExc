import { cn } from '../../lib/utils/cn.util.js';
import { EmptyState } from '../ui/EmptyState.jsx';
import { ErrorState } from '../ui/ErrorState.jsx';
import { LoadingState } from '../ui/LoadingState.jsx';

export function ChartContainer({
  title,
  subtitle,
  actions,
  isLoading,
  error,
  isEmpty,
  emptyTitle = 'No data',
  emptyDescription,
  onRetry,
  height = 320,
  className,
  children,
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-5 shadow-sm', className)}>
      {title || actions ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}

      <div style={{ height }}>
        {isLoading ? (
          <LoadingState label="Loading chart" />
        ) : error ? (
          <ErrorState
            title="Chart unavailable"
            description="We could not load this chart. Please try again."
            onRetry={onRetry}
          />
        ) : isEmpty ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            className="h-full border-0 bg-transparent"
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
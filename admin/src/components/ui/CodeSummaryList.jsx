import { cn } from '../../lib/utils/cn.util.js';

export function CodeSummaryList({ items = [], className }) {
  return (
    <dl className={cn('flex flex-col divide-y divide-border', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              'text-right text-xs font-medium text-foreground',
              item.tone === 'success' && 'text-success',
              item.tone === 'warning' && 'text-warning',
              item.tone === 'destructive' && 'text-destructive',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
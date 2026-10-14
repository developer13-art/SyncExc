import { cn } from '../../lib/utils/cn.util.js';

export function Timeline({ items, className }) {
  return (
    <ol className={cn('relative flex flex-col gap-4', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.icon;

        return (
          <li key={item.id ?? index} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                  item.tone === 'success' && 'border-success bg-success/10 text-success',
                  item.tone === 'warning' && 'border-warning bg-warning/10 text-warning',
                  item.tone === 'destructive' &&
                    'border-destructive bg-destructive/10 text-destructive',
                  !item.tone && 'border-border bg-muted text-muted-foreground',
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              </div>
              {!isLast ? <div className="mt-1 w-px flex-1 bg-border" /> : null}
            </div>
            <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.timestamp ? (
                  <p className="shrink-0 text-xs text-muted-foreground">{item.timestamp}</p>
                ) : null}
              </div>
              {item.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              ) : null}
              {item.content ? <div className="mt-2">{item.content}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
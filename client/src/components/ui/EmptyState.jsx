import { cn } from '../../lib/utils/cn.util.js';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
}) {
  const sizes = {
    sm: { wrap: 'py-8', title: 'text-sm', desc: 'text-xs' },
    md: { wrap: 'py-12', title: 'text-base', desc: 'text-sm' },
    lg: { wrap: 'py-16', title: 'text-lg', desc: 'text-sm' },
  };

  const s = sizes[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 text-center',
        s.wrap,
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : null}
      {title ? <h3 className={cn('font-semibold text-foreground', s.title)}>{title}</h3> : null}
      {description ? (
        <p className={cn('mt-1.5 max-w-md text-muted-foreground', s.desc)}>{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
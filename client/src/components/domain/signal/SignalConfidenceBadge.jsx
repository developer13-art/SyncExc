import { cn } from '../../../lib/utils/cn.util.js';

const CONFIDENCE_LEVELS = {
  high: { label: 'High', className: 'text-success', barCount: 3 },
  medium: { label: 'Medium', className: 'text-warning', barCount: 2 },
  low: { label: 'Low', className: 'text-destructive', barCount: 1 },
  unresolved: { label: 'Unresolved', className: 'text-muted-foreground', barCount: 0 },
};

export function SignalConfidenceBadge({ level, score, className }) {
  const config = CONFIDENCE_LEVELS[level] ?? CONFIDENCE_LEVELS.unresolved;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'w-1 rounded-sm',
              i === 1 && 'h-1.5',
              i === 2 && 'h-2',
              i === 3 && 'h-3',
              i <= config.barCount ? config.className.replace('text-', 'bg-') : 'bg-muted',
            )}
          />
        ))}
      </span>
      <span className={cn('text-2xs font-medium', config.className)}>
        {config.label}
        {typeof score === 'number' ? ` · ${Math.round(score * 100)}%` : ''}
      </span>
    </span>
  );
}
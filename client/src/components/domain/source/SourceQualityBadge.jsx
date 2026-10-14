import { cn } from '../../../lib/utils/cn.util.js';

export function SourceQualityBadge({ score, status, className }) {
  const numeric = typeof score === 'number' ? score : null;

  let tone = 'text-muted-foreground border-border bg-muted/30';
  if (numeric !== null) {
    if (numeric >= 80) {
      tone = 'text-success border-success/30 bg-success/5';
    } else if (numeric >= 60) {
      tone = 'text-warning border-warning/30 bg-warning/5';
    } else {
      tone = 'text-destructive border-destructive/30 bg-destructive/5';
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium',
        tone,
        className,
      )}
    >
      {numeric !== null ? `${numeric.toFixed(0)}%` : (status ?? 'Unknown')}
      {status && numeric !== null ? <span className="opacity-70">· {status}</span> : null}
    </span>
  );
}
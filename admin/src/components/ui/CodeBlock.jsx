import { cn } from '../../lib/utils/cn.util.js';
import { CopyButton } from './CopyButton.jsx';

export function CodeBlock({ code, language = 'text', className }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border border-border',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {language}
        </span>
        <CopyButton value={code} size="sm" />
      </div>
      <pre className="overflow-x-auto scrollbar-thin bg-background p-3 font-mono text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
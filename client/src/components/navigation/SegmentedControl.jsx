import { cn } from '../../lib/utils/cn.util.js';

export function SegmentedControl({ options = [], value, onChange, className }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-md border border-border bg-muted/40 p-0.5 text-xs',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1 rounded-sm px-2.5 py-1 font-medium transition',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.icon ? <option.icon className="h-3 w-3" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
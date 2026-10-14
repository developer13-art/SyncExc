import { cn } from '../../lib/utils/cn.util.js';

export function ChartTooltip({ active, payload, label, formatter, className }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md',
        className,
      )}
    >
      {label !== undefined ? (
        <p className="mb-1.5 font-medium text-foreground">{label}</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {payload.map((entry, index) => {
          const value = formatter ? formatter(entry.value, entry.name, entry) : entry.value;
          return (
            <li
              key={`${entry.name}-${index}`}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color ?? entry.stroke }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
              </span>
              <span className="font-medium text-foreground">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
import { useMemo } from 'react';

import { cn } from '../../lib/utils/cn.util.js';
import { EmptyState } from '../ui/EmptyState.jsx';

const INTENSITY_CLASSES = [
  'bg-muted/40',
  'bg-primary/15',
  'bg-primary/30',
  'bg-primary/50',
  'bg-primary/70',
];

function intensityFor(value, max) {
  if (!max || max <= 0) {
    return 0;
  }
  const ratio = Math.min(1, Math.abs(value) / max);
  if (ratio === 0) {
    return 0;
  }
  return Math.min(INTENSITY_CLASSES.length - 1, Math.ceil(ratio * (INTENSITY_CLASSES.length - 1)));
}

export function HeatmapChart({
  title,
  subtitle,
  data = [],
  rows = [],
  columns = [],
  rowKey = 'row',
  columnKey = 'column',
  valueKey = 'value',
  formatValue,
  className,
}) {
  const grid = useMemo(() => {
    const map = new Map();
    let max = 0;
    for (const cell of data) {
      map.set(`${cell[rowKey]}::${cell[columnKey]}`, cell[valueKey]);
      max = Math.max(max, Math.abs(cell[valueKey] ?? 0));
    }
    return { map, max };
  }, [data, rowKey, columnKey, valueKey]);

  if (!rows.length || !columns.length) {
    return (
      <EmptyState title="No heatmap data" className={className} />
    );
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-5 shadow-sm', className)}>
      {title ? (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card p-2 text-left text-2xs font-medium text-muted-foreground"></th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="p-2 text-center text-2xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <td className="sticky left-0 z-10 bg-card p-2 text-left text-xs font-medium text-foreground">
                  {row}
                </td>
                {columns.map((col) => {
                  const value = grid.map.get(`${row}::${col}`) ?? 0;
                  const intensity = intensityFor(value, grid.max);
                  return (
                    <td key={`${row}-${col}`} className="p-1">
                      <div
                        title={formatValue ? formatValue(value, row, col) : `${value}`}
                        className={cn(
                          'flex h-9 w-14 items-center justify-center rounded-sm text-2xs font-medium text-foreground transition hover:ring-2 hover:ring-primary/40',
                          INTENSITY_CLASSES[intensity],
                        )}
                      >
                        {formatValue ? formatValue(value, row, col) : value || ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
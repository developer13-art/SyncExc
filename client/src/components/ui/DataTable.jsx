import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';
import { Skeleton } from './Skeleton.jsx';
import { EmptyState } from './EmptyState.jsx';

export function DataTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  isLoading = false,
  emptyTitle = 'No results',
  emptyDescription,
  emptyAction,
  emptyIcon,
  sortKey,
  sortDirection,
  onSortChange,
  onRowClick,
  className,
}) {
  return (
    <div className={cn('overflow-x-auto scrollbar-thin rounded-lg border border-border', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left">
            {columns.map((col) => {
              const sortable = col.sortable && onSortChange;
              const active = sortKey === col.key;

              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'whitespace-nowrap border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    sortable && 'cursor-pointer select-none hover:text-foreground',
                  )}
                  onClick={() => sortable && onSortChange(col.key, active && sortDirection === 'asc' ? 'desc' : 'asc')}
                >
                  <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                    {col.label}
                    {sortable ? (
                      active ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-50" />
                      )
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skel-${i}`} className="border-b border-border last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                  action={emptyAction}
                  className="border-0 bg-transparent"
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border last:border-0 transition',
                  onRowClick && 'cursor-pointer hover:bg-muted/40',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 align-middle',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className,
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
import { ArrowRight, Minus, Plus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { cn } from '../../lib/utils/cn.util.js';

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, path));
    } else {
      result[path] = value;
    }
  }
  return result;
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  }
  return JSON.stringify(value);
}

export function BeforeAfterDiff({ before = {}, after = {}, className }) {
  const beforeFlat = flattenObject(before);
  const afterFlat = flattenObject(after);

  const keys = new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]);

  const rows = [];
  for (const key of Array.from(keys).sort()) {
    const beforeValue = beforeFlat[key];
    const afterValue = afterFlat[key];
    const beforeStr = formatValue(beforeValue);
    const afterStr = formatValue(afterValue);
    const changed = beforeStr !== afterStr;

    rows.push({
      key,
      beforeValue: beforeStr,
      afterValue: afterStr,
      changed,
      wasAdded: beforeValue === undefined && afterValue !== undefined,
      wasRemoved: beforeValue !== undefined && afterValue === undefined,
    });
  }

  const changedRows = rows.filter((r) => r.changed);

  if (changedRows.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No changes were recorded for this action.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Change summary</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Field
                </th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Before
                </th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              {changedRows.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 align-top">
                    <code className="text-xs font-medium text-foreground">{row.key}</code>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <span
                      className={cn(
                        'inline-flex items-start gap-1 rounded-sm px-1.5 py-0.5 text-xs',
                        row.wasAdded
                          ? 'text-muted-foreground'
                          : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {row.wasAdded ? null : <Minus className="mt-0.5 h-3 w-3 shrink-0" />}
                      {row.beforeValue}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <span
                      className={cn(
                        'inline-flex items-start gap-1 rounded-sm px-1.5 py-0.5 text-xs',
                        row.wasRemoved
                          ? 'text-muted-foreground'
                          : 'bg-success/10 text-success',
                      )}
                    >
                      {row.wasRemoved ? null : <Plus className="mt-0.5 h-3 w-3 shrink-0" />}
                      {row.afterValue}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
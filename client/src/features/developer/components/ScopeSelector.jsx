import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '../../../components/ui/Input.jsx';
import { Checkbox } from '../../../components/ui/Checkbox.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function ScopeSelector({ scopes = [], value = [], onChange, className }) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const map = new Map();
    for (const scope of scopes) {
      const group = scope.group ?? 'General';
      if (!map.has(group)) {
        map.set(group, []);
      }
      map.get(group).push(scope);
    }
    return Array.from(map.entries());
  }, [scopes]);

  const filtered = useMemo(() => {
    if (!query) {
      return grouped;
    }
    const q = query.toLowerCase();
    return grouped
      .map(([group, list]) => [
        group,
        list.filter(
          (s) =>
            s.name?.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q),
        ),
      ])
      .filter(([, list]) => list.length > 0);
  }, [grouped, query]);

  const toggle = (scopeName) => {
    if (value.includes(scopeName)) {
      onChange?.(value.filter((s) => s !== scopeName));
    } else {
      onChange?.([...value, scopeName]);
    }
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search scopes…"
          className="pl-9"
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {value.length} of {scopes.length} scopes selected
        </span>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange?.([])}
            className="text-primary hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="max-h-96 overflow-y-auto scrollbar-thin rounded-md border border-border p-3">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No scopes match your search.
          </p>
        ) : (
          filtered.map(([group, list]) => (
            <div key={group} className="mb-4 last:mb-0">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <ul className="flex flex-col gap-2">
                {list.map((scope) => {
                  const isSelected = value.includes(scope.name);
                  return (
                    <li key={scope.name}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded-md border p-2 transition',
                          isSelected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border hover:bg-muted/40',
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(scope.name)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <code className="text-xs font-medium text-foreground">
                              {scope.name}
                            </code>
                            {scope.sensitive ? (
                              <Badge variant="warning" size="sm">
                                Sensitive
                              </Badge>
                            ) : null}
                          </span>
                          {scope.description ? (
                            <span className="mt-0.5 block text-2xs text-muted-foreground">
                              {scope.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
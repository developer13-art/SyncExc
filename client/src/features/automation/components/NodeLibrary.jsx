import { useMemo, useState } from 'react';
import {
  Boxes,
  Clock,
  Filter,
  GitBranch,
  Play,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';

import { SearchInput } from '../../../components/forms/SearchInput.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

const CATEGORY_ICONS = {
  triggers: Play,
  conditions: Filter,
  data: Boxes,
  flow: GitBranch,
  approvals: ShieldCheck,
  actions: Send,
  integrations: Zap,
  utilities: Settings2,
};

export function NodeLibrary({ nodes = [], onDragStart, onAddNode, className }) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const map = new Map();
    for (const node of nodes) {
      const cat = node.category ?? 'actions';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat).push(node);
    }
    return Array.from(map.entries());
  }, [nodes]);

  const filtered = useMemo(() => {
    if (!query) {
      return grouped;
    }
    const q = query.toLowerCase();
    return grouped
      .map(([category, list]) => [
        category,
        list.filter(
          (n) =>
            n.label?.toLowerCase().includes(q) ||
            n.description?.toLowerCase().includes(q),
        ),
      ])
      .filter(([, list]) => list.length > 0);
  }, [grouped, query]);

  return (
    <div className={cn('flex h-full flex-col border-r border-border bg-background', className)}>
      <div className="border-b border-border p-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search nodes…"
          delayMs={150}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No nodes match your search.
          </p>
        ) : (
          filtered.map(([category, list]) => {
            const Icon = CATEGORY_ICONS[category] ?? Workflow;
            return (
              <div key={category} className="mb-4 last:mb-0">
                <p className="mb-2 flex items-center gap-1.5 px-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {category}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {list.map((node) => (
                    <li key={node.type}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStart?.(e, node)}
                        onClick={() => onAddNode?.(node)}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left transition',
                          'hover:border-primary/50 hover:bg-muted/40',
                        )}
                      >
                        {node.icon ? (
                          <node.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-foreground">
                            {node.label}
                          </span>
                          {node.description ? (
                            <span className="mt-0.5 block line-clamp-2 text-2xs text-muted-foreground">
                              {node.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-2 text-2xs text-muted-foreground">
        <p className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Drag a node onto the canvas, or click to append.
        </p>
      </div>
    </div>
  );
}
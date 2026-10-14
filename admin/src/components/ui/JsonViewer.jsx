import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';

function JsonNode({ nodeKey, value, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  if (!isObject) {
    return (
      <div className="flex items-baseline gap-2 py-0.5">
        {nodeKey !== undefined ? <span className="text-info">{String(nodeKey)}:</span> : null}
        <span
          className={cn(
            typeof value === 'string' && 'text-success',
            typeof value === 'number' && 'text-warning',
            typeof value === 'boolean' && 'text-destructive',
            value === null && 'text-muted-foreground',
          )}
        >
          {value === null ? 'null' : JSON.stringify(value)}
        </span>
      </div>
    );
  }

  const entries = isArray ? value.map((v, i) => [i, v]) : Object.entries(value);

  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {nodeKey !== undefined ? <span className="text-info">{String(nodeKey)}:</span> : null}
        <span className="text-muted-foreground">
          {isArray ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {expanded ? (
        <div className="ml-4 border-l border-border pl-3">
          {entries.map(([k, v]) => (
            <JsonNode key={k} nodeKey={k} value={v} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function JsonViewer({ data, className }) {
  return (
    <div
      className={cn(
        'overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs scrollbar-thin',
        className,
      )}
    >
      <JsonNode value={data} />
    </div>
  );
}
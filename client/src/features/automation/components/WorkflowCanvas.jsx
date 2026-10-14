import { useCallback, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { IconButton } from '../../../components/ui/IconButton.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

export function WorkflowCanvas({
  nodes = [],
  selectedNodeId,
  onSelectNode,
  onDeleteNode,
  onNodeMove,
  onDropNode,
  className,
}) {
  const [dragging, setDragging] = useState(null);
  const canvasRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleCanvasDrop = useCallback(
    (e) => {
      e.preventDefault();
      try {
        const data = e.dataTransfer.getData('application/json');
        if (!data) {
          return;
        }
        const nodeDef = JSON.parse(data);
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - NODE_WIDTH / 2;
        const y = e.clientY - rect.top - NODE_HEIGHT / 2;
        onDropNode?.(nodeDef, { x: Math.max(0, x), y: Math.max(0, y) });
      } catch {
        // Ignore malformed payloads.
      }
    },
    [onDropNode],
  );

  const handleDragStart = (node) => (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(node.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e) => {
    if (!dragging) {
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.current.x;
    const y = e.clientY - rect.top - dragOffset.current.y;
    onNodeMove?.(dragging, { x: Math.max(0, x), y: Math.max(0, y) });
  };

  const handleDragEnd = (e) => {
    if (dragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture was already released.
      }
    }
    setDragging(null);
  };

  const connections = useMemo(() => {
    const map = new Map(nodes.map((n) => [n.id, n]));
    const lines = [];
    for (const node of nodes) {
      for (const output of node.outputs ?? []) {
        if (!output.target) {
          continue;
        }
        const from = map.get(node.id);
        const to = map.get(output.target);
        if (!from || !to) {
          continue;
        }
        lines.push({
          id: `${node.id}-${output.target}`,
          from: { x: (from.position?.x ?? 0) + NODE_WIDTH, y: (from.position?.y ?? 0) + NODE_HEIGHT / 2 },
          to: { x: (to.position?.x ?? 0), y: (to.position?.y ?? 0) + NODE_HEIGHT / 2 },
          tone: output.tone,
        });
      }
    }
    return lines;
  }, [nodes]);

  return (
    <div
      ref={canvasRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      className={cn(
        'relative h-full w-full overflow-auto scrollbar-thin bg-muted/10',
        className,
      )}
      style={{
        backgroundImage:
          'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
          </marker>
        </defs>
        {connections.map((conn) => {
          const midX = (conn.from.x + conn.to.x) / 2;
          const path = `M ${conn.from.x} ${conn.from.y} C ${midX} ${conn.from.y}, ${midX} ${conn.to.y}, ${conn.to.x} ${conn.to.y}`;
          return (
            <path
              key={conn.id}
              d={path}
              fill="none"
              stroke={
                conn.tone === 'success'
                  ? 'hsl(var(--success))'
                  : conn.tone === 'failure'
                    ? 'hsl(var(--destructive))'
                    : 'hsl(var(--muted-foreground))'
              }
              strokeWidth={2}
              markerEnd="url(#arrow)"
            />
          );
        })}
      </svg>

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-dashed border-border bg-background/80 p-6 text-center">
            <p className="text-sm font-medium text-foreground">Workflow is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag a trigger node from the library to begin.
            </p>
          </div>
        </div>
      ) : null}

      {nodes.map((node) => {
        const isSelected = node.id === selectedNodeId;
        const isDragging = node.id === dragging;
        return (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectNode?.(node.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectNode?.(node.id);
              }
            }}
            onPointerDown={handleDragStart(node)}
            style={{
              position: 'absolute',
              left: node.position?.x ?? 0,
              top: node.position?.y ?? 0,
              width: NODE_WIDTH,
              minHeight: NODE_HEIGHT,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            className={cn(
              'group select-none rounded-lg border-2 bg-background p-3 text-left shadow-sm transition',
              isSelected
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-border hover:border-primary/40',
              isDragging && 'shadow-md',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {node.category}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {node.label}
                </p>
                {node.summary ? (
                  <p className="mt-1 line-clamp-2 text-2xs text-muted-foreground">
                    {node.summary}
                  </p>
                ) : null}
              </div>
              <IconButton
                label="Delete node"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNode?.(node.id);
                }}
                className="opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </IconButton>
            </div>

            {node.validationError ? (
              <p className="mt-2 rounded-sm border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-2xs text-destructive">
                {node.validationError}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
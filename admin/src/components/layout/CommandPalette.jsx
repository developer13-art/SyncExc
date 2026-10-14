import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command, CornerDownLeft, Search } from 'lucide-react';

import { uiActions, selectCommandPaletteOpen } from '../../app/slices/uiSlice.js';
import { ADMIN_NAV_SECTIONS } from '../../lib/constants/route.constants.js';
import { cn } from '../../lib/utils/cn.util.js';

const EXTRA_ACTIONS = [
  { id: 'audit', label: 'Search audit history', path: '/audit', keywords: 'audit log' },
  {
    id: 'approvals',
    label: 'View pending approvals',
    path: '/approvals',
    keywords: 'approval pending',
  },
  {
    id: 'feature-flags-new',
    label: 'Create a feature flag',
    path: '/feature-flags/new',
    keywords: 'flag rollout',
  },
  {
    id: 'alerts-events',
    label: 'View alert events',
    path: '/alerts/events',
    keywords: 'alert event',
  },
];

export function CommandPalette() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const open = useSelector(selectCommandPaletteOpen);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => {
    const navItems = ADMIN_NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        id: `${section.id}:${item.id}`,
        label: item.label,
        section: section.label,
        path: item.path,
        keywords: `${item.label} ${section.label}`.toLowerCase(),
      })),
    );

    return [...navItems, ...EXTRA_ACTIONS];
  }, []);

  const filtered = useMemo(() => {
    if (!query) {
      return items.slice(0, 20);
    }
    const q = query.toLowerCase();
    return items
      .filter((item) => item.keywords.includes(q) || item.label.toLowerCase().includes(q))
      .slice(0, 20);
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const select = (item) => {
    if (!item) {
      return;
    }
    dispatch(uiActions.closeCommandPalette());
    navigate(item.path);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(filtered[activeIndex]);
    }
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => dispatch(o ? uiActions.openCommandPalette() : uiActions.closeCommandPalette())}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-24 z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-fade-in"
          onKeyDown={handleKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, actions, and settings…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
              ESC
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto scrollbar-thin p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No matches for "{query}"
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filtered.map((item, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => select(item)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Command className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{item.label}</span>
                          {item.section ? (
                            <span className="truncate text-2xs text-muted-foreground">
                              · {item.section}
                            </span>
                          ) : null}
                        </span>
                        {isActive ? (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
            Use ↑↓ to navigate · Enter to select · Esc to close
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
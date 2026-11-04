import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  FolderOpen,
  ShieldCheck,
} from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';
import { ADMIN_SECTIONS } from '../../config/admin-navigation.js';
import {
  uiActions,
  selectSidebarCollapsed,
} from '../../app/slices/uiSlice.js';

export function AdminSidebar() {
  const dispatch = useDispatch();
  const location = useLocation();
  const collapsed = useSelector(selectSidebarCollapsed);
  const [expandedSection, setExpandedSection] = useState(null);
  const [search, setSearch] = useState('');

  const isActive = (path) => {
    const [pathname, search] = path.split('?');
    if (search) return location.pathname === pathname && location.search === `?${search}`;
    return location.pathname === pathname || location.pathname.startsWith(`${pathname}/`);
  };
  const activeSection = ADMIN_SECTIONS.find((section) =>
    section.items.some((item) => isActive(item.path)),
  )?.id;

  useEffect(() => {
    if (activeSection) setExpandedSection(activeSection);
  }, [activeSection]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleSections = ADMIN_SECTIONS.map((section) => {
    if (!normalizedSearch || section.label.toLowerCase().includes(normalizedSearch)) {
      return section;
    }
    return {
      ...section,
      items: section.items.filter((item) =>
        item.label.toLowerCase().includes(normalizedSearch),
      ),
    };
  }).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-background transition-all',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex items-center gap-2 px-3 py-4', collapsed && 'justify-center')}>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              SyncExc
            </p>
            <p className="truncate text-2xs uppercase tracking-wide text-muted-foreground">
              Admin Console
            </p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {!collapsed ? (
          <input
            type="search"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              const normalized = value.trim().toLowerCase();
              if (!normalized) return;
              const match = ADMIN_SECTIONS.find((section) =>
                section.label.toLowerCase().includes(normalized) ||
                section.items.some((item) => item.label.toLowerCase().includes(normalized)),
              );
              if (match) setExpandedSection(match.id);
            }}
            placeholder="Find an admin page"
            aria-label="Find an admin page"
            className="mb-3 h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : null}
        {visibleSections.map((section) => (
          <div key={section.id} className="mb-4">
            <button
              type="button"
              onClick={() => setExpandedSection((current) =>
                current === section.id ? null : section.id,
              )}
              title={collapsed ? section.label : undefined}
              aria-expanded={expandedSection === section.id}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide transition',
                activeSection === section.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-1',
              )}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="flex-1">{section.label}</span> : null}
              {!collapsed ? (
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform',
                    expandedSection === section.id && 'rotate-180',
                  )}
                />
              ) : null}
            </button>
            {expandedSection === section.id || Boolean(normalizedSearch) ? (
              <ul className="mt-1 flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.path}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex items-center gap-2 rounded-md py-1.5 text-xs font-medium transition',
                          collapsed ? 'justify-center px-1' : 'pl-8 pr-2',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                        {collapsed ? <span className="h-1 w-1 rounded-full bg-current" /> : null}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => dispatch(uiActions.toggleSidebar())}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
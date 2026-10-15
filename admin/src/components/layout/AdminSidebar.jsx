import { NavLink, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';
import { ADMIN_NAV_SECTIONS } from '../../lib/constants/route.constants.js';
import { uiActions, selectSidebarCollapsed } from '../../app/slices/uiSlice.js';
import { useAuthContext } from '../../context/AuthContext.jsx';

function NavIcon({ name, className }) {
  const icons = {
    dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    connections: 'M8 7H6a3 3 0 0 0 0 6h2M16 7h2a3 3 0 0 1 0 6h-2M7 10h10',
    sync: 'M21 4v5h-5M3 20v-5h5M21 9a9 9 0 0 0-15-3M3 15a9 9 0 0 0 15 3',
    risk: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM12 10v4M12 17h.01',
    sources: 'M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 8a4 4 0 0 1 4 4M8 12a4 4 0 0 1 4-4M12 16a4 4 0 0 1-4-4M16 12a4 4 0 0 1-4 4',
    signals: 'M3 17l4-8 4 5 4-10 4 8h3',
    referral: 'M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20a6 6 0 0 1 6-6M11 20a6 6 0 0 1 6-6',
    billing: 'M3 6h18v12H3zM3 10h18M7 15h2',
    support: 'M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm0 13v.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7v.3',
    community: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM15 20a5 5 0 0 1 6-4.5',
    workspaces: 'M3 6h18v14H3zM8 6V4h8v2M3 12h18',
    automation: 'M6 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.5 6h7M6 8.5v7M18 8.5v7M8.5 18h7',
    notifications: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
    settings:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM20.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  };

  const d = icons[name] ?? icons.dashboard;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

export function AdminSidebar() {
  const dispatch = useDispatch();
  const location = useLocation();
  const collapsed = useSelector(selectSidebarCollapsed);
  const { admin } = useAuthContext();

  const isActive = (path) =>
    location.pathname === path ||
    (path !== '/overview' && location.pathname.startsWith(path));

  return (
    <aside
      className={cn(
        'admin-sidebar sticky top-0 flex h-screen flex-col border-r border-border bg-background transition-all',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-4 border-b border-border',
          collapsed && 'justify-center px-0',
        )}
      >
        <div className="admin-brand-mark flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              SyncExc Admin
            </p>
            <p className="truncate text-2xs uppercase tracking-[0.12em] text-muted-foreground">
              Admin Console
            </p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3 pt-3">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.id} className="mb-4 last:mb-0">
            {!collapsed ? (
              <p className="mb-2 px-2 text-2xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'admin-nav-link flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition',
                        collapsed && 'justify-center px-2',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        {!collapsed && admin?.roleSummary ? (
          <p className="mb-2 px-2 text-2xs text-muted-foreground">
            {admin.roleSummary}
          </p>
        ) : null}
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
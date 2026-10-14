import { NavLink, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';
import { NAV_SECTIONS } from '../../lib/constants/route.constants.js';
import { uiActions, selectSidebarCollapsed } from '../../app/slices/uiSlice.js';
import { WorkspaceSwitcher } from './WorkspaceSwitcher.jsx';
import * as Icons from '../../assets/icons/index.js';

function IconByName({ name, className }) {
  const map = {
    dashboard: Icons.DashboardIcon,
    terminal: Icons.TerminalIcon,
    connections: Icons.ConnectionsIcon,
    sync: Icons.SyncIcon,
    risk: Icons.RiskIcon,
    sources: Icons.SourcesIcon,
    signals: Icons.SignalsIcon,
    marketplace: Icons.MarketplaceIcon,
    automation: Icons.AutomationIcon,
    simulation: Icons.SimulationIcon,
    developer: Icons.DeveloperIcon,
    community: Icons.CommunityIcon,
    referral: Icons.ReferralIcon,
    billing: Icons.BillingIcon ?? Icons.ReferralIcon,
    support: Icons.SupportIcon,
    notifications: Icons.NotificationsIcon,
    settings: Icons.SettingsIcon,
  };
  const Component = map[name] ?? Icons.DashboardIcon;
  return <Component className={className} />;
}

export function Sidebar() {
  const dispatch = useDispatch();
  const location = useLocation();
  const collapsed = useSelector(selectSidebarCollapsed);

  const isActive = (path) =>
    location.pathname === path ||
    (path !== '/app/dashboard' && location.pathname.startsWith(path));

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-background transition-all',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className={cn('flex items-center gap-2 px-3 py-4', collapsed && 'justify-center')}>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <Icons.LogoIcon className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <span className="text-base font-semibold tracking-tight text-foreground">
            SyncExc
          </span>
        ) : null}
      </div>

      <div className={cn('px-3 pb-3', collapsed && 'hidden')}>
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="mb-4">
            {!collapsed ? (
              <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                        'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition',
                        collapsed && 'justify-center px-2',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <IconByName name={item.icon} className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
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
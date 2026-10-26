import { NavLink, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import {
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';
import { NAV_SECTIONS, TRADER_NAV_SECTIONS } from '../../lib/constants/route.constants.js';
import {
  uiActions,
  selectMobileNavOpen,
  selectSidebarCollapsed,
} from '../../app/slices/uiSlice.js';
import { WorkspaceSwitcher } from './WorkspaceSwitcher.jsx';
import * as Icons from '../../assets/icons/index.js';
import { BrandLogo } from '../../components/brand/BrandLogo.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';

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
  const mobileNavOpen = useSelector(selectMobileNavOpen);
  const { activeWorkspace, permissions = [] } = useWorkspaceContext();
  const sections = (activeWorkspace?.type === 'trader' ? TRADER_NAV_SECTIONS : NAV_SECTIONS)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        !item.requiresPermissions ||
        item.requiresPermissions.every((permission) => permissions.includes(permission)),
      ),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        dispatch(uiActions.closeMobileNav());
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, mobileNavOpen]);

  const isActive = (item) => {
    if (item.id === 'marketplace') {
      return location.pathname === item.path ||
        (location.pathname.startsWith(`${item.path}/`) &&
          !location.pathname.startsWith('/app/marketplace/profile'));
    }
    return location.pathname === item.path ||
      (item.path !== '/app/dashboard' && item.path !== '/app/trader/dashboard' &&
        location.pathname.startsWith(item.path));
  };

  return (
    <aside
      id="app-sidebar"
      className={cn(
        'client-sidebar fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col border-r border-border bg-background text-foreground transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 md:transition-[width]',
        mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
        collapsed ? 'md:w-16' : 'md:w-60',
      )}
    >
      <div className={cn('flex items-center gap-2 px-3 py-4', collapsed && 'md:justify-center')}>
        <BrandLogo className="client-brand-mark h-8 w-8" />
        <span className={cn('flex-1 text-base font-semibold tracking-tight text-foreground', collapsed && 'md:hidden')}>
          SyncExc
        </span>
        <button
          type="button"
          onClick={() => dispatch(uiActions.closeMobileNav())}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className={cn('px-3 pb-3', collapsed && 'md:hidden')}>
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {sections.map((section) => (
          <div key={section.id} className="mb-4">
            <p className={cn('mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground', collapsed && 'md:hidden')}>
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      onClick={() => dispatch(uiActions.closeMobileNav())}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'client-nav-link flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition',
                        collapsed && 'md:justify-center md:px-2',
                        active
                          ? 'bg-primary/15 text-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <IconByName name={item.icon} className="h-4 w-4 shrink-0" />
                      <span className={cn('truncate', collapsed && 'md:hidden')}>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="hidden border-t border-border p-2 md:block">
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
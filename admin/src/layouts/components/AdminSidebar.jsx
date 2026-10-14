import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  Users,
  Building2,
  CreditCard,
  Receipt,
  DollarSign,
  Repeat,
  Compass,
  Radio,
  Coins,
  Headphones,
  ToggleRight,
  ShieldCheck,
  CheckSquare,
  FileSearch,
  Bell,
  Cpu,
} from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';
import {
  adminUiActions,
  selectAdminSidebarCollapsed,
} from '../../app/slices/adminUiSlice.js';

const SECTIONS = [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'overview', label: 'Overview', path: '/overview', icon: Activity },
      { id: 'users', label: 'Users', path: '/users', icon: Users },
      { id: 'workspaces', label: 'Workspaces', path: '/workspaces', icon: Building2 },
      {
        id: 'operation-jobs',
        label: 'Operation Jobs',
        path: '/operation-jobs',
        icon: Cpu,
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    items: [
      { id: 'plans', label: 'Plans', path: '/plans', icon: CreditCard },
      { id: 'subscriptions', label: 'Subscriptions', path: '/subscriptions', icon: Receipt },
      { id: 'payments', label: 'Payments', path: '/payments', icon: DollarSign },
      { id: 'refunds', label: 'Refunds', path: '/refunds', icon: Repeat },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'exchanges', label: 'Exchanges', path: '/exchanges', icon: Building2 },
      {
        id: 'source-discovery',
        label: 'Source Discovery',
        path: '/source-discovery',
        icon: Compass,
      },
      {
        id: 'signal-sources',
        label: 'Signal Sources',
        path: '/signal-sources',
        icon: Radio,
      },
      { id: 'referrals', label: 'Referrals', path: '/referrals', icon: Coins },
      { id: 'support', label: 'Support', path: '/support', icon: Headphones },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    items: [
      { id: 'feature-flags', label: 'Feature Flags', path: '/feature-flags', icon: ToggleRight },
      { id: 'roles', label: 'Roles', path: '/roles', icon: ShieldCheck },
      { id: 'approvals', label: 'Approvals', path: '/approvals', icon: CheckSquare },
      { id: 'audit', label: 'Audit', path: '/audit', icon: FileSearch },
      { id: 'alerts', label: 'Alerts', path: '/alerts', icon: Bell },
    ],
  },
];

export function AdminSidebar() {
  const dispatch = useDispatch();
  const location = useLocation();
  const collapsed = useSelector(selectAdminSidebarCollapsed);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

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
        {SECTIONS.map((section) => (
          <div key={section.id} className="mb-4">
            {!collapsed ? (
              <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
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
                      <Icon className="h-4 w-4 shrink-0" />
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
          onClick={() => dispatch(adminUiActions.toggleSidebar())}
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
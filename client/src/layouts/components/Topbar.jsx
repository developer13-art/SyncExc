import { useDispatch, useSelector } from 'react-redux';
import { Menu } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';
import { Breadcrumbs } from './Breadcrumbs.jsx';
import { UserMenu } from './UserMenu.jsx';
import { NotificationsMenu } from './NotificationsMenu.jsx';
import { selectWsConnected } from '../../features/notifications/notificationsSlice.js';
import { selectMobileNavOpen, uiActions } from '../../app/slices/uiSlice.js';

export function Topbar({ className }) {
  const dispatch = useDispatch();
  const wsConnected = useSelector(selectWsConnected);
  const mobileNavOpen = useSelector(selectMobileNavOpen);

  return (
    <header
      className={cn(
        'client-topbar sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => dispatch(uiActions.openMobileNav())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground md:hidden"
          aria-label="Open navigation menu"
          aria-controls="app-sidebar"
          aria-expanded={mobileNavOpen}
        >
          <Menu className="h-4 w-4" />
        </button>
        <Breadcrumbs className="hidden min-w-0 md:flex" />
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            'hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-medium md:inline-flex',
            wsConnected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
              : 'border-border bg-muted text-muted-foreground',
          )}
          title={wsConnected ? 'Realtime connected' : 'Realtime disconnected'}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              wsConnected ? 'bg-emerald-500 animate-pulse-subtle' : 'bg-muted-foreground',
            )}
          />
          {wsConnected ? 'Live' : 'Offline'}
        </span>

        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}

export { useLocation } from 'react-router-dom';
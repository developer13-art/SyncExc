import { useSelector } from 'react-redux';

import { cn } from '../../lib/utils/cn.util.js';
import { Breadcrumbs } from './Breadcrumbs.jsx';
import { UserMenu } from './UserMenu.jsx';
import { NotificationsMenu } from './NotificationsMenu.jsx';
import { selectWsConnected } from '../../features/notifications/notificationsSlice.js';

export function Topbar({ className }) {
  const wsConnected = useSelector(selectWsConnected);

  return (
    <header
      className={cn(
        'client-topbar sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Breadcrumbs className="min-w-0" />
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
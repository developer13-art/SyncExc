import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Command, LogOut, Search, ShieldAlert, User } from 'lucide-react';

import { IconButton } from '../ui/IconButton.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '../ui/Dropdown.jsx';
import { ConsoleBreadcrumbs } from './ConsoleBreadcrumbs.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { uiActions, selectCommandPaletteOpen } from '../../app/slices/uiSlice.js';
import { cn } from '../../lib/utils/cn.util.js';
import { ROUTES } from '../../config/routes.config.js';

export function AdminTopbar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { admin, logout } = useAuthContext();
  const permissions = usePermissions();
  const commandPaletteOpen = useSelector(selectCommandPaletteOpen);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dispatch(uiActions.toggleCommandPalette());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.auth.login, { replace: true });
  };

  const initials = (admin?.displayName ?? admin?.email ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="admin-topbar sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <ConsoleBreadcrumbs className="min-w-0" />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => dispatch(uiActions.openCommandPalette())}
          className={cn(
            'admin-search-button hidden items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-flex',
            commandPaletteOpen && 'border-primary text-primary',
          )}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search or jump</span>
          <span className="ml-2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
            ⌘K
          </span>
        </button>

        <Badge variant="muted" size="sm" className="hidden md:inline-flex">
          <ShieldAlert className="mr-1 h-3 w-3" />
          {admin?.roleSummary ?? 'Administrator'}
        </Badge>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition',
                'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="Account menu"
            >
              <div className="admin-avatar flex h-7 w-7 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground">
                {initials}
              </div>
              <span className="hidden max-w-[10rem] truncate text-xs font-medium text-foreground md:inline">
                {admin?.displayName ?? admin?.email}
              </span>
            </button>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownLabel>Signed in as</DropdownLabel>
            <div className="px-2 pb-1.5 text-2xs text-muted-foreground">
              <p className="truncate">{admin?.email ?? ''}</p>
              {admin?.roleSummary ? (
                <p className="mt-0.5 truncate">{admin.roleSummary}</p>
              ) : null}
            </div>
            <DropdownSeparator />
            <DropdownItem onSelect={() => navigate('/audit')}>
              <User className="h-3.5 w-3.5" /> My activity
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              onSelect={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
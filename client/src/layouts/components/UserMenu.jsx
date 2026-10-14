import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

import { Avatar } from '../../components/ui/Avatar.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function UserMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();

  if (!user) {
    return null;
  }

  const initials = (user.displayName ?? user.email ?? '?')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.auth.login, { replace: true });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition',
            'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label="Account menu"
        >
          <Avatar size="sm" fallback={initials} />
          <span className="hidden max-w-32 truncate text-sm font-medium text-foreground md:inline">
            {user.displayName ?? user.username ?? user.email}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:inline" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
        >
          <div className="flex flex-col gap-1 border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {user.displayName ?? user.username}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>

          <DropdownMenu.Item asChild>
            <Link
              to={ROUTES.app.settings.profile}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-muted"
            >
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span>Profile</span>
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              to={ROUTES.app.settings.security}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-muted"
            >
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span>Security</span>
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              to={ROUTES.app.settings.notifications}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-muted"
            >
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              <span>Settings</span>
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={handleLogout}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
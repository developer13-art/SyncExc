import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useAdminAuth } from '../../hooks/useAuth.js';
import { cn } from '../../lib/utils/cn.util.js';

export function AdminUserMenu() {
  const navigate = useNavigate();
  const { user, roles, logout } = useAdminAuth();

  if (!user) {
    return null;
  }

  const initials = (user.displayName ?? user.email ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
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
          <Avatar size="sm" src={user.avatarUrl} fallback={initials} />
          <span className="hidden max-w-32 truncate text-sm font-medium text-foreground md:inline">
            {user.displayName ?? user.email}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:inline" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-64 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
        >
          <div className="flex flex-col gap-1 border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {user.displayName ?? user.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            {roles?.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {roles.slice(0, 3).map((role) => (
                  <Badge key={role} variant="muted" size="sm">
                    {role}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <DropdownMenu.Item
            asChild
            className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-muted"
          >
            <a href="/profile">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span>My staff profile</span>
            </a>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            asChild
            className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-muted"
          >
            <a href="/roles">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span>My roles and permissions</span>
            </a>
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
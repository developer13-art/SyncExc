import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ChevronsUpDown,
  Check,
  Plus,
  Building2,
  User as UserIcon,
  Store,
  Code2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '../../lib/utils/cn.util.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { ROUTES } from '../../config/routes.config.js';

function WorkspaceIcon({ type }) {
  if (type === 'organization') {
    return <Building2 className="h-4 w-4 text-muted-foreground" />;
  }
  if (type === 'trader') {
    return <Store className="h-4 w-4 text-muted-foreground" />;
  }
  if (type === 'developer') {
    return <Code2 className="h-4 w-4 text-muted-foreground" />;
  }
  return <UserIcon className="h-4 w-4 text-muted-foreground" />;
}

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspaceContext();

  const label = activeWorkspace?.name ?? 'Select workspace';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition',
            'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <WorkspaceIcon type={activeWorkspace?.type} />
            <span className="truncate font-medium text-foreground">{label}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
        >
          <DropdownMenu.Label className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Workspaces
          </DropdownMenu.Label>
          {workspaces.length === 0 ? (
            <DropdownMenu.Item
              disabled
              className="rounded-sm px-3 py-2 text-sm text-muted-foreground"
            >
              No workspaces available
            </DropdownMenu.Item>
          ) : (
            workspaces.map((workspace) => (
              <DropdownMenu.Item
                key={workspace.id}
                disabled={workspace.status !== 'active'}
                onSelect={() => switchWorkspace(workspace.id)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
              >
                <span className="flex items-center gap-2 truncate">
                  <WorkspaceIcon type={workspace.type} />
                  <span className="truncate">
                    {workspace.name}
                    {workspace.status !== 'active' ? ` · ${workspace.status}` : ''}
                  </span>
                </span>
                {workspace.id === activeWorkspace?.id ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : null}
              </DropdownMenu.Item>
            ))
          )}

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={() => navigate(ROUTES.app.settings.workspaceNew)}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-muted"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span>Create workspace</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
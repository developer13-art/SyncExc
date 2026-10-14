import { useState } from 'react';
import { MoreVertical, ShieldCheck, UserMinus, UserCheck } from 'lucide-react';

import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../../../components/ui/Dropdown.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  active: 'success',
  suspended: 'warning',
  removed: 'muted',
  invited: 'info',
};

export function MemberTable({
  members = [],
  roles = [],
  isLoading,
  onChangeRole,
  onSuspend,
  onRestore,
  onRemove,
  className,
}) {
  const [removeTarget, setRemoveTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleRemove = async () => {
    if (!removeTarget) {
      return;
    }
    setProcessing(true);
    try {
      await onRemove?.(removeTarget);
      setRemoveTarget(null);
    } finally {
      setProcessing(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Member',
      render: (row) => {
        const initials = (row.displayName ?? '?')
          .split(' ')
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <Avatar size="sm" src={row.avatarUrl} fallback={initials} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {row.displayName ?? 'User'}
              </p>
              <p className="truncate text-2xs text-muted-foreground">
                {row.email ?? ''}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => {
        const role = roles.find((r) => r.id === row.roleId);
        return (
          <Badge variant={row.roleId === 'owner' ? 'info' : 'muted'}>
            {role?.name ?? row.roleName ?? 'Member'}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status ?? 'active'}
        </Badge>
      ),
    },
    {
      key: 'joinedAt',
      label: 'Joined',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.joinedAt ? formatRelativeTime(row.joinedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => {
        const isOwner = row.roleId === 'owner';
        return (
          <DropdownMenu>
            <DropdownTrigger asChild>
              <IconButton label="Member actions" size="sm" disabled={isOwner}>
                <MoreVertical className="h-4 w-4" />
              </IconButton>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownItem onSelect={() => onChangeRole?.(row)}>
                <ShieldCheck className="h-3.5 w-3.5" /> Change role
              </DropdownItem>
              <DropdownSeparator />
              {row.status === 'suspended' ? (
                <DropdownItem onSelect={() => onRestore?.(row)}>
                  <UserCheck className="h-3.5 w-3.5" /> Restore access
                </DropdownItem>
              ) : (
                <DropdownItem onSelect={() => onSuspend?.(row)}>
                  <UserMinus className="h-3.5 w-3.5" /> Suspend
                </DropdownItem>
              )}
              <DropdownItem
                onSelect={() => setRemoveTarget(row)}
                className="text-destructive focus:text-destructive"
              >
                Remove from workspace
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={members}
        isLoading={isLoading}
        emptyTitle="No members"
        emptyDescription="Invite team members to collaborate in this workspace."
        className={className}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove member?"
        description="The member will lose workspace access immediately. Their historical contributions and audit history are preserved."
        confirmLabel="Remove member"
        variant="destructive"
        onConfirm={handleRemove}
        isLoading={processing}
      />
    </>
  );
}
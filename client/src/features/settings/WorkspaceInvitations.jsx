import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { isValidEmail } from '../../lib/validators/email.validator.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_VARIANTS = {
  pending: 'warning',
  accepted: 'success',
  expired: 'muted',
  revoked: 'muted',
};

export default function WorkspaceInvitations() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', roleId: '' });

  const invitationsQuery = useQuery({
    queryKey: queryKeys.workspaces.invitations(workspaceId, {}),
    queryFn: () => workspacesApi.listInvitations(workspaceId, {}),
    enabled: Boolean(workspaceId),
  });

  const rolesQuery = useQuery({
    queryKey: queryKeys.workspaces.roles(workspaceId),
    queryFn: () => workspacesApi.listRoles(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => workspacesApi.createInvitation(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.invitations(workspaceId, {}),
      });
      toast.success('Invitation sent');
      setInviteOpen(false);
      setInviteForm({ email: '', roleId: '' });
    },
    onError: (err) =>
      toast.error('Failed to invite', { description: getErrorMessage(err) }),
  });

  const handleRevoke = async (invitation) => {
    try {
      await workspacesApi.revokeInvitation(workspaceId, invitation.id);
      toast.success('Invitation revoked');
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.invitations(workspaceId, {}),
      });
    } catch (err) {
      toast.error('Revoke failed', { description: getErrorMessage(err) });
    }
  };

  const handleResend = async (invitation) => {
    try {
      await workspacesApi.resendInvitation(workspaceId, invitation.id);
      toast.success('Invitation resent');
    } catch (err) {
      toast.error('Resend failed', { description: getErrorMessage(err) });
    }
  };

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Invitations'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Workspaces', path: ROUTES.app.settings.workspaces },
        {
          label: 'Invitations',
          path: ROUTES.app.settings.workspaceInvitations(workspaceId),
        },
      ]),
    );
  }, [dispatch, workspaceId]);

  const handleInvite = () => {
    if (!inviteForm.email.trim() || !isValidEmail(inviteForm.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    createMutation.mutate({
      email: inviteForm.email.trim().toLowerCase(),
      roleId: inviteForm.roleId || undefined,
    });
  };

  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (row) => (
        <span className="font-mono text-xs text-foreground">{row.email}</span>
      ),
    },
    {
      key: 'roleName',
      label: 'Role',
      render: (row) => (
        <Badge variant="muted">{row.roleName ?? 'Member'}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status ?? 'pending'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Sent',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'expiresAt',
      label: 'Expires',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.expiresAt ? formatRelativeTime(row.expiresAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === 'pending' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResend(row)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => handleRevoke(row)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.settings.workspace(workspaceId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Invitations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invitations grant workspace access after acceptance and server-side validation.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" /> Invite member
        </Button>
      </div>

      <Card>
        <CardContent className="p-5 pt-5">
          <DataTable
            columns={columns}
            rows={invitationsQuery.data?.items ?? []}
            isLoading={invitationsQuery.isLoading}
            emptyTitle="No invitations"
            emptyDescription="Invite team members to this workspace."
          />
        </CardContent>
      </Card>

      <Modal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a member"
        description="The invitation is validated and requires acceptance before access is granted."
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={createMutation.isPending || !inviteForm.email}
            >
              {createMutation.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Email address" htmlFor="invite-email" required>
            <Input
              id="invite-email"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder="teammate@example.com"
            />
          </FormField>

          <FormField label="Role" htmlFor="invite-role">
            <Select
              value={inviteForm.roleId}
              onValueChange={(v) => setInviteForm({ ...inviteForm, roleId: v })}
            >
              <SelectTrigger id="invite-role" className="mt-1.5">
                <SelectValue placeholder="Default member role" />
              </SelectTrigger>
              <SelectContent>
                {(rolesQuery.data ?? []).map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
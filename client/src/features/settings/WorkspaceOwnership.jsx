import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Crown, UserCheck } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceOwnership() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ recipientUserId: '', reason: '' });

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId),
    queryFn: () => workspacesApi.getById(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId, {}),
    queryFn: () => workspacesApi.listMembers(workspaceId, { status: 'active' }),
    enabled: Boolean(workspaceId),
  });

  const transferMutation = useMutation({
    mutationFn: (payload) => workspacesApi.initiateOwnershipTransfer(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) });
      toast.success('Ownership transfer initiated', {
        description: 'The recipient must accept the transfer to complete it.',
      });
      setTransferOpen(false);
      setTransferForm({ recipientUserId: '', reason: '' });
    },
    onError: (err) =>
      toast.error('Transfer failed', { description: getErrorMessage(err) }),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Ownership'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Workspaces', path: ROUTES.app.settings.workspaces },
        {
          label: 'Ownership',
          path: ROUTES.app.settings.workspaceOwnership(workspaceId),
        },
      ]),
    );
  }, [dispatch, workspaceId]);

  if (workspaceQuery.isLoading) {
    return <LoadingState label="Loading ownership" />;
  }

  const workspace = workspaceQuery.data;
  const members = membersQuery.data?.items ?? [];
  const eligibleMembers = members.filter((m) => m.userId !== workspace?.ownerId);

  const handleInitiateTransfer = () => {
    if (!transferForm.recipientUserId) {
      toast.error('Select a recipient');
      return;
    }
    if (!transferForm.reason.trim()) {
      toast.error('Provide a reason');
      return;
    }
    transferMutation.mutate({
      recipientUserId: transferForm.recipientUserId,
      reason: transferForm.reason.trim(),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.settings.workspace(workspaceId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ownership</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ownership is a distinct responsibility, not an ordinary role. Transfers require
          explicit confirmation from both parties.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <CardTitle>Current owner</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium text-foreground">
            {workspace?.ownerName ?? workspace?.ownerId}
          </p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {workspace?.ownerEmail ?? ''}
          </p>
        </CardContent>
      </Card>

      <Alert variant="warning" title="Transferring ownership">
        <p className="text-xs">
          Ownership transfer is a two-party process. The recipient must accept. The transfer
          does not move personal exchange connections into the organization — sharing is
          managed separately.
        </p>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Initiate a transfer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Recipient" htmlFor="transfer-recipient" required>
            <select
              id="transfer-recipient"
              value={transferForm.recipientUserId}
              onChange={(e) =>
                setTransferForm({ ...transferForm, recipientUserId: e.target.value })
              }
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select recipient…</option>
              {eligibleMembers.map((m) => (
                <option key={m.userId ?? m.id} value={m.userId ?? m.id}>
                  {m.displayName ?? m.email ?? m.userId}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Reason"
            htmlFor="transfer-reason"
            hint="Recorded for audit."
          >
            <Input
              id="transfer-reason"
              value={transferForm.reason}
              onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
              placeholder="Reason for transferring ownership"
            />
          </FormField>

          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={() => setTransferOpen(true)}
              disabled={eligibleMembers.length === 0}
            >
              <AlertTriangle className="h-4 w-4" /> Initiate transfer
            </Button>
          </div>

          {eligibleMembers.length === 0 ? (
            <p className="text-2xs text-muted-foreground">
              Invite and activate at least one member before transferring ownership.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Modal
        open={transferOpen}
        onOpenChange={setTransferOpen}
        title="Confirm ownership transfer"
        description="The recipient will receive an acceptance request. Until then, ownership remains with the current owner."
        footer={
          <>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleInitiateTransfer}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? 'Initiating…' : 'Initiate transfer'}
            </Button>
          </>
        }
      >
        <Alert variant="warning" title="Two-party confirmation required">
          <p className="text-xs">
            Ownership does not transfer until the recipient accepts. Until acceptance, the
            current owner remains responsible.
          </p>
        </Alert>
      </Modal>
    </div>
  );
}
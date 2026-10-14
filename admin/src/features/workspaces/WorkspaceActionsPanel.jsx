import { useState } from 'react';
import { PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useStepUpAuth } from '../../hooks/useStepUpAuth.js';
import { StepUpDialog } from '../auth/components/StepUpDialog.jsx';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';

export function WorkspaceActionsPanel({ workspace, onSuspend, onRestore, onCorrectMetadata }) {
  const toast = useToast();
  const permissions = usePermissions();
  const stepUp = useStepUpAuth();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!workspace) {
    return null;
  }

  const isSuspended = workspace.status === 'suspended';

  const canSuspend = permissions.can('admin.workspaces.suspend');
  const canRestore = permissions.can('admin.workspaces.restore');
  const canCorrectMetadata = permissions.can('admin.workspaces.correct_metadata');

  const handleSuspend = async (payload) => {
    setProcessing(true);
    try {
      await onSuspend({ workspaceId: workspace.id, ...payload });
      toast.success('Workspace suspended');
    } catch (err) {
      toast.error('Suspension failed', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async (payload) => {
    setProcessing(true);
    try {
      await onRestore({ workspaceId: workspace.id, ...payload });
      toast.success('Workspace restored');
    } catch (err) {
      toast.error('Restore failed', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleCorrectMetadata = () => {
    stepUp.requiresStepUp({
      reason:
        'Correcting workspace metadata is audited with your identity, the reason, and the change.',
      run: async () => {
        try {
          await onCorrectMetadata?.({ workspaceId: workspace.id });
          toast.success('Metadata correction requested');
        } catch (err) {
          toast.error('Correction failed', { description: getErrorMessage(err) });
        }
      },
    });
  };

  const actions = [
    {
      key: 'suspend',
      visible: canSuspend && !isSuspended,
      icon: PauseCircle,
      label: 'Suspend workspace',
      description: 'Blocks new workspace operations. Existing exchange state is not altered.',
      variant: 'destructive',
      onClick: () => setSuspendOpen(true),
    },
    {
      key: 'restore',
      visible: canRestore && isSuspended,
      icon: PlayCircle,
      label: 'Restore workspace',
      description: 'Removes the suspension after review.',
      variant: 'default',
      onClick: () => setRestoreOpen(true),
    },
    {
      key: 'metadata',
      visible: canCorrectMetadata,
      icon: ShieldCheck,
      label: 'Correct metadata',
      description:
        'Corrections require a reason and produce a new version. Historical values are preserved.',
      variant: 'outline',
      onClick: handleCorrectMetadata,
    },
  ].filter((a) => a.visible);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Administrative actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Alert variant="info" title="Scope of administrative action">
            <p className="text-xs">
              Restricting a workspace affects only that workspace. It does not silently suspend
              unrelated personal workspaces owned by the same user.
            </p>
          </Alert>

          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You do not have permission to perform administrative actions on this workspace.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <li key={action.key}>
                    <Button
                      variant={action.variant}
                      className="w-full justify-start"
                      onClick={action.onClick}
                      disabled={processing}
                    >
                      <Icon className="h-4 w-4" />
                      <div className="ml-2 flex flex-col items-start">
                        <span>{action.label}</span>
                        <span className="text-2xs font-normal opacity-80">
                          {action.description}
                        </span>
                      </div>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspend workspace?"
        description="New workspace operations are blocked. Exchange orders and positions already submitted remain subject to exchange rules."
        confirmLabel="Suspend workspace"
        variant="destructive"
        requireReason
        onConfirm={handleSuspend}
        isLoading={processing}
      />

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restore workspace?"
        description="Removes the workspace suspension. Any revoked member sessions are not automatically restored."
        confirmLabel="Restore workspace"
        requireReason
        onConfirm={handleRestore}
        isLoading={processing}
      />

      <StepUpDialog
        open={Boolean(stepUp.pending)}
        onOpenChange={(open) => {
          if (!open) {
            stepUp.cancel();
          }
        }}
        action={stepUp.pending}
        onConfirm={stepUp.confirm}
        error={stepUp.error}
        submitting={stepUp.submitting}
      />
    </>
  );
}
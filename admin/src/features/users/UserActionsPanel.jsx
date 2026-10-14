import { useState } from 'react';
import {
  KeyRound,
  LogOut,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { SuspendUserDialog } from './SuspendUserDialog.jsx';
import { RestoreUserDialog } from './RestoreUserDialog.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useStepUpAuth } from '../../hooks/useStepUpAuth.js';
import { StepUpDialog } from '../auth/components/StepUpDialog.jsx';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';

export function UserActionsPanel({ user, onSuspend, onRestore, onRevokeSessions, onRequireReset, onResetMfa }) {
  const toast = useToast();
  const permissions = usePermissions();
  const stepUp = useStepUpAuth();

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!user) {
    return null;
  }

  const isSuspended =
    user.status === 'suspended' || user.status === 'temporarily_restricted';

  const canSuspend = permissions.can('admin.users.suspend');
  const canRestore = permissions.can('admin.users.restore');
  const canRevokeSessions = permissions.can('admin.users.revoke_sessions');
  const canRequireReset = permissions.can('admin.users.require_credential_reset');
  const canResetMfa = permissions.can('admin.users.reset_mfa_recovery');

  const handleSuspend = async (payload) => {
    setProcessing(true);
    try {
      await onSuspend({ userId: user.id, ...payload });
      toast.success('Restriction applied');
    } catch (err) {
      toast.error('Failed to apply restriction', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async (payload) => {
    setProcessing(true);
    try {
      await onRestore({ userId: user.id, ...payload });
      toast.success('Access restored');
    } catch (err) {
      toast.error('Failed to restore access', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleRevokeSessions = async () => {
    setProcessing(true);
    try {
      await onRevokeSessions({ userId: user.id, reason: 'Revoked by administrator' });
      toast.success('Sessions revoked');
      setRevokeOpen(false);
    } catch (err) {
      toast.error('Failed to revoke sessions', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const handleRequireReset = () => {
    stepUp.requiresStepUp({
      reason:
        'Requiring a credential reset will invalidate the user\'s current password and notify them via a safe channel.',
      run: async () => {
        try {
          await onRequireReset({ userId: user.id });
          toast.success('Credential reset required');
        } catch (err) {
          toast.error('Failed to require reset', { description: getErrorMessage(err) });
        }
      },
    });
  };

  const handleResetMfa = () => {
    stepUp.requiresStepUp({
      reason:
        'Resetting MFA requires verified recovery. The user will be notified through a security channel.',
      run: async () => {
        try {
          await onResetMfa({ userId: user.id });
          toast.success('MFA reset through verified recovery');
        } catch (err) {
          toast.error('MFA reset failed', { description: getErrorMessage(err) });
        }
      },
    });
  };

  const actions = [
    {
      key: 'suspend',
      visible: canSuspend && !isSuspended,
      icon: PauseCircle,
      label: 'Restrict account',
      description: 'Apply a scoped restriction with a recorded reason.',
      variant: 'destructive',
      onClick: () => setSuspendOpen(true),
    },
    {
      key: 'restore',
      visible: canRestore && isSuspended,
      icon: PlayCircle,
      label: 'Restore access',
      description: 'Remove active restrictions after review.',
      variant: 'default',
      onClick: () => setRestoreOpen(true),
    },
    {
      key: 'revoke',
      visible: canRevokeSessions,
      icon: LogOut,
      label: 'Revoke all sessions',
      description: 'Immediately sign the user out everywhere.',
      variant: 'outline',
      onClick: () => setRevokeOpen(true),
    },
    {
      key: 'reset-password',
      visible: canRequireReset,
      icon: KeyRound,
      label: 'Require credential reset',
      description:
        'Invalidate the password and notify the user through a safe channel.',
      variant: 'outline',
      onClick: handleRequireReset,
    },
    {
      key: 'reset-mfa',
      visible: canResetMfa,
      icon: ShieldAlert,
      label: 'Reset MFA through recovery',
      description:
        'Verified recovery only. Does not silently disable MFA.',
      variant: 'outline',
      onClick: handleResetMfa,
    },
  ].filter((a) => a.visible);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Administrative actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Alert variant="info" title="Every action is audited">
            <p className="text-xs">
              These actions are recorded with your identity, the reason, and the outcome.
              Sensitive actions may require step-up authentication.
            </p>
          </Alert>

          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You do not have permission to perform administrative actions on this account.
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

          <p className="flex items-start gap-1.5 text-2xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" />
            <span>
              Passwords, MFA secrets, recovery codes, session tokens, and exchange credentials
              are never displayed or transferred between accounts.
            </span>
          </p>
        </CardContent>
      </Card>

      <SuspendUserDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        user={user}
        onConfirm={handleSuspend}
        isSubmitting={processing}
      />

      <RestoreUserDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        user={user}
        onConfirm={handleRestore}
        isSubmitting={processing}
      />

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke all sessions?"
        description="The user will be signed out immediately on all devices. This action is audited."
        confirmLabel="Revoke sessions"
        variant="destructive"
        requireReason
        onConfirm={handleRevokeSessions}
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
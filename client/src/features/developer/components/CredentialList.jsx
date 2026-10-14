import { useState } from 'react';
import { KeyRound, RefreshCw, Trash2 } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { CopyButton } from '../../../components/ui/CopyButton.jsx';
import { cn } from '../../../lib/utils/cn.util.js';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';

const STATE_VARIANTS = {
  active: 'success',
  expired: 'muted',
  rotation_pending: 'warning',
  revoked: 'destructive',
  compromised: 'destructive',
};

export function CredentialList({
  credentials = [],
  onRotate,
  onRevoke,
  onReveal,
  className,
}) {
  const [rotateTarget, setRotateTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleRotate = async () => {
    if (!rotateTarget) {
      return;
    }
    setProcessing(true);
    try {
      await onRotate?.(rotateTarget);
      setRotateTarget(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) {
      return;
    }
    setProcessing(true);
    try {
      await onRevoke?.(revokeTarget);
      setRevokeTarget(null);
    } finally {
      setProcessing(false);
    }
  };

  if (credentials.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No credentials yet</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Create a credential with the scopes your integration needs. The secret is shown
            once — store it securely.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ul className={cn('flex flex-col gap-3', className)}>
        {credentials.map((credential) => (
          <li key={credential.id}>
            <Card>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {credential.label ?? credential.name ?? credential.id}
                      </p>
                      <Badge variant={STATE_VARIANTS[credential.status] ?? 'muted'}>
                        {credential.status ?? 'active'}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-2xs text-foreground">
                        {credential.maskedKey ?? credential.prefix ?? '••••••••'}
                      </code>
                      {credential.revealedSecret ? (
                        <CopyButton value={credential.revealedSecret} />
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReveal?.(credential)}
                    >
                      {credential.revealedSecret ? 'Hide' : 'Reveal'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRotateTarget(credential)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Rotate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRevokeTarget(credential)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs md:grid-cols-4">
                  {credential.scopes?.length > 0 ? (
                    <div className="col-span-2 md:col-span-2">
                      <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                        Scopes
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {credential.scopes.slice(0, 6).map((scope) => (
                          <span
                            key={scope}
                            className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground"
                          >
                            {scope}
                          </span>
                        ))}
                        {credential.scopes.length > 6 ? (
                          <span className="text-2xs text-muted-foreground">
                            +{credential.scopes.length - 6} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <Field
                    label="Created"
                    value={
                      credential.createdAt ? formatDateTime(credential.createdAt) : '—'
                    }
                  />
                  <Field
                    label="Expires"
                    value={
                      credential.expiresAt ? formatDateTime(credential.expiresAt) : 'never'
                    }
                  />
                </div>

                {credential.revealedSecret ? (
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-2xs text-warning">
                    This secret is shown once. Copy it now and store it in a secure location.
                    It will not be displayed again.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(rotateTarget)}
        onOpenChange={(open) => !open && setRotateTarget(null)}
        title="Rotate credential?"
        description="A new secret will be generated. The old secret remains valid for a short, explicitly bounded overlap window. Update your integration before the overlap expires."
        confirmLabel="Rotate"
        variant="warning"
        onConfirm={handleRotate}
        isLoading={processing}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke credential?"
        description="Revocation takes effect immediately at the API authorization boundary. Any requests using this credential will fail."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevoke}
        isLoading={processing}
      />
    </>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
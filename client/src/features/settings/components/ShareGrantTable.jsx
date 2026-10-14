import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Trash2 } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../../config/routes.config.js';

export function ShareGrantTable({ grants = [], onRevoke, isRevoking }) {
  const [revokeTarget, setRevokeTarget] = useState(null);

  const handleRevoke = async () => {
    if (!revokeTarget) {
      return;
    }
    await onRevoke?.(revokeTarget);
    setRevokeTarget(null);
  };

  if (grants.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No connection sharing grants.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {grants.map((grant) => (
              <li
                key={grant.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {grant.connectionLabel ?? grant.connectionId}
                    </p>
                    <Badge
                      variant={
                        grant.status === 'active'
                          ? 'success'
                          : grant.status === 'revoked'
                            ? 'muted'
                            : 'warning'
                      }
                    >
                      {grant.status ?? 'active'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Shared with {grant.recipientWorkspaceName ?? grant.recipientWorkspaceId}
                    {grant.grantedAt ? ` · ${formatDateTime(grant.grantedAt)}` : ''}
                  </p>
                  {grant.allowedOperations?.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {grant.allowedOperations.map((op) => (
                        <span
                          key={op}
                          className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground"
                        >
                          {op.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {grant.expiresAt ? (
                    <p className="mt-1 text-2xs text-muted-foreground">
                      Expires {formatDateTime(grant.expiresAt)}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={ROUTES.app.connections.details(grant.connectionId)}>
                      <ExternalLink className="h-3.5 w-3.5" /> Connection
                    </Link>
                  </Button>
                  {grant.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRevokeTarget(grant)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke share grant?"
        description="The recipient workspace loses access to this connection. The connection itself remains owned by your workspace."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevoke}
        isLoading={isRevoking}
      />
    </>
  );
}
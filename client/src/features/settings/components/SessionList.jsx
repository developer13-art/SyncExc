import { useEffect, useState } from 'react';
import { Monitor, Smartphone, Trash2 } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { identityApi } from '../../../api/index.js';
import { queryKeys } from '../../../hooks/queryKeys.js';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../api/errors.js';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';

export function SessionList({ className }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState(null);

  const sessionsQuery = useQuery({
    queryKey: queryKeys.auth.sessions,
    queryFn: () => identityApi.listSessions(),
    refetchInterval: 60_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId) => identityApi.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
      toast.success('Session revoked');
      setRevokeTarget(null);
    },
    onError: (err) =>
      toast.error('Revocation failed', { description: getErrorMessage(err) }),
  });

  useEffect(() => {
    if (sessionsQuery.error) {
      toast.error('Failed to load sessions', {
        description: getErrorMessage(sessionsQuery.error),
      });
    }
  }, [sessionsQuery.error, toast]);

  if (sessionsQuery.isLoading) {
    return <LoadingState label="Loading sessions" />;
  }

  const sessions = sessionsQuery.data ?? [];

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {sessions.map((session) => {
            const isMobile = /iPhone|Android|iPad/i.test(session.userAgent ?? '');
            const Icon = isMobile ? Smartphone : Monitor;

            return (
              <li
                key={session.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {session.deviceLabel ?? session.userAgent ?? 'Unknown device'}
                      </p>
                      {session.current ? (
                        <Badge variant="success" size="sm">
                          Current
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {session.ipAddress ? `${session.ipAddress} · ` : ''}
                      {session.createdAt
                        ? `Created ${formatRelativeTime(session.createdAt)}`
                        : ''}
                      {session.lastActivityAt
                        ? ` · Active ${formatRelativeTime(session.lastActivityAt)}`
                        : ''}
                    </p>
                  </div>
                </div>

                {!session.current ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setRevokeTarget(session)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        <ConfirmDialog
          open={Boolean(revokeTarget)}
          onOpenChange={(open) => !open && setRevokeTarget(null)}
          title="Revoke session?"
          description="The device will be signed out immediately. The account's other sessions are not affected."
          confirmLabel="Revoke"
          variant="destructive"
          onConfirm={() => revokeMutation.mutate(revokeTarget.id)}
          isLoading={revokeMutation.isPending}
        />
      </CardContent>
    </Card>
  );
}
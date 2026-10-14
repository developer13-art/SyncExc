import { useState } from 'react';
import { Laptop, Monitor, Smartphone, Trash2 } from 'lucide-react';

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

function iconFor(device) {
  const ua = (device.userAgent ?? '').toLowerCase();
  if (ua.includes('iphone') || ua.includes('android') || ua.includes('ipad')) {
    return Smartphone;
  }
  if (ua.includes('mac') || ua.includes('linux')) {
    return Laptop;
  }
  return Monitor;
}

export function DeviceList({ className }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState(null);

  const devicesQuery = useQuery({
    queryKey: queryKeys.auth.trustedDevices,
    queryFn: () => identityApi.listTrustedDevices(),
  });

  const revokeMutation = useMutation({
    mutationFn: (deviceId) => identityApi.revokeTrustedDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.trustedDevices });
      toast.success('Device trust revoked');
      setRevokeTarget(null);
    },
    onError: (err) =>
      toast.error('Revocation failed', { description: getErrorMessage(err) }),
  });

  if (devicesQuery.isLoading) {
    return <LoadingState label="Loading devices" />;
  }

  const devices = devicesQuery.data ?? [];

  if (devices.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No trusted devices registered.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {devices.map((device) => {
            const Icon = iconFor(device);
            return (
              <li
                key={device.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {device.label ?? device.userAgent ?? 'Device'}
                      </p>
                      {device.trustExpired ? (
                        <Badge variant="muted" size="sm">
                          Trust expired
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {device.createdAt
                        ? `Added ${formatRelativeTime(device.createdAt)}`
                        : ''}
                      {device.lastSeenAt
                        ? ` · Last seen ${formatRelativeTime(device.lastSeenAt)}`
                        : ''}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setRevokeTarget(device)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Revoke trust
                </Button>
              </li>
            );
          })}
        </ul>

        <ConfirmDialog
          open={Boolean(revokeTarget)}
          onOpenChange={(open) => !open && setRevokeTarget(null)}
          title="Revoke device trust?"
          description="The device will no longer be recognized. The next sign-in from that device may require additional verification."
          confirmLabel="Revoke trust"
          variant="destructive"
          onConfirm={() => revokeMutation.mutate(revokeTarget.id)}
          isLoading={revokeMutation.isPending}
        />
      </CardContent>
    </Card>
  );
}
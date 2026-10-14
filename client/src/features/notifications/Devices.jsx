import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ArrowLeft, Smartphone, Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useNotificationDevices } from '../../hooks/useNotifications.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Devices() {
  const dispatch = useDispatch();
  const toast = useToast();
  const devices = useNotificationDevices();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Notification Devices'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Notifications', path: ROUTES.app.notifications.overview },
        { label: 'Devices', path: ROUTES.app.notifications.devices },
      ]),
    );
  }, [dispatch]);

  const handleRegister = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast.error('Push notifications are not supported in this browser');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Push permission was not granted');
        return;
      }
      toast.success('Push registration requested');
      devices.registerDevice({ type: 'web_push' });
    } catch (err) {
      toast.error('Registration failed', { description: getErrorMessage(err) });
    }
  };

  const handleRemove = async (device) => {
    try {
      await devices.removeDevice(device.id);
      toast.success('Device removed');
    } catch (err) {
      toast.error('Remove failed', { description: getErrorMessage(err) });
    }
  };

  if (devices.isLoading) {
    return <LoadingState label="Loading devices" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.notifications.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Notification Devices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Devices registered for push notifications. You can revoke any device at any time.
          </p>
        </div>
        <Button onClick={handleRegister}>
          <Smartphone className="h-4 w-4" /> Register this device
        </Button>
      </div>

      {devices.devices.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No devices registered"
          description="Register this browser or a mobile device to receive push notifications."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {devices.devices.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {device.label ?? device.type ?? 'Device'}
                      </p>
                      {device.status === 'active' ? (
                        <Badge variant="success" size="sm">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          {device.status ?? 'inactive'}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {device.browser ?? ''}
                      {device.os ? ` · ${device.os}` : ''}
                      {device.registeredAt
                        ? ` · Registered ${formatRelativeTime(device.registeredAt)}`
                        : ''}
                    </p>
                    {device.lastDeliveryAt ? (
                      <p className="text-2xs text-muted-foreground">
                        Last delivery {formatRelativeTime(device.lastDeliveryAt)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleRemove(device)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Push delivery depends on your browser, device settings, and provider availability. If
          push fails, the in-app notification center remains the authoritative record.
        </CardContent>
      </Card>
    </div>
  );
}
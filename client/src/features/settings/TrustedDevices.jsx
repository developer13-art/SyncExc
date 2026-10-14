import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DeviceList } from './components/DeviceList.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function TrustedDevices() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Trusted Devices'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Trusted devices', path: ROUTES.app.settings.devices },
      ]),
    );
  }, [dispatch]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Trusted Devices
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Devices you have marked as trusted. Device recognition is a convenience and risk
          signal — not proof of identity or a replacement for MFA.
        </p>
      </div>

      <DeviceList />

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          A trusted device never bypasses required MFA, grants workspace permissions, or
          authorizes trading. Trust expires according to the configured period.
        </CardContent>
      </Card>
    </div>
  );
}
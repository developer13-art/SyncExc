import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { LogOut } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { SessionList } from './components/SessionList.jsx';
import { identityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Sessions() {
  const dispatch = useDispatch();
  const toast = useToast();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Active Sessions'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Sessions', path: ROUTES.app.settings.sessions },
      ]),
    );
  }, [dispatch]);

  const handleLogoutAll = async () => {
    try {
      await identityApi.logoutAll();
      toast.success('All sessions revoked');
    } catch (err) {
      toast.error('Failed to revoke all sessions', {
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Active Sessions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Devices currently signed in to your account. Revoke any session you don't
            recognize.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogoutAll}>
          <LogOut className="h-4 w-4" /> Sign out everywhere else
        </Button>
      </div>

      <SessionList />

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Revoking a session takes effect immediately on the server. The browser on that device
          will be signed out the next time it makes a request.
        </CardContent>
      </Card>
    </div>
  );
}
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { SettingsSectionNav } from './components/SettingsSectionNav.jsx';

export default function NotificationSettings() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Notification Settings'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        {
          label: 'Notifications',
          path: ROUTES.app.settings.notifications,
        },
      ]),
    );
  }, [dispatch]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Notification Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Notification preferences, quiet hours, and push device management are centralized in
          the Notifications area.
        </p>
      </div>
      <SettingsSectionNav activePath={ROUTES.app.settings.notifications} />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Manage delivery channels, categories, and quiet hours from the notification
            preferences page.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to={ROUTES.app.notifications.preferences}>
                Notification preferences <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={ROUTES.app.notifications.devices}>
                Manage devices <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
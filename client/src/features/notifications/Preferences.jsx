import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { PreferenceToggle } from './components/PreferenceToggle.jsx';
import { useNotificationPreferences } from '../../hooks/useNotifications.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const CHANNELS = [
  { key: 'inApp', label: 'In-app', description: 'Notifications in the SyncExc notification center.' },
  { key: 'email', label: 'Email', description: 'Delivered to your verified email address.' },
  { key: 'push', label: 'Push', description: 'Delivered via browser or device push.' },
];

const CATEGORIES = [
  {
    key: 'trading',
    label: 'Trading and execution',
    description: 'Order fills, rejections, execution uncertainty, synchronization outcomes.',
  },
  {
    key: 'signals',
    label: 'Signals and sources',
    description: 'New validated signals, parsing issues, source outages and recoveries.',
  },
  {
    key: 'automation',
    label: 'Automation and workflows',
    description: 'Workflow runs, approvals, retries, failures.',
  },
  {
    key: 'risk',
    label: 'Risk and safety',
    description: 'Risk blocks, approvals, circuit breakers, emergency pauses.',
    mandatory: true,
  },
  {
    key: 'billing',
    label: 'Billing and subscription',
    description: 'Renewals, payment failures, refunds, subscription changes.',
  },
  {
    key: 'security',
    label: 'Account security',
    description: 'New sign-ins, password changes, MFA changes, session revocations.',
    mandatory: true,
  },
  {
    key: 'community',
    label: 'Community and collaboration',
    description: 'Mentions, replies, group activity, moderation outcomes.',
  },
  {
    key: 'developer',
    label: 'Developer platform',
    description: 'API usage warnings, webhook delivery failures, credential security.',
  },
  {
    key: 'support',
    label: 'Support',
    description: 'Ticket replies, status changes, escalations.',
  },
  {
    key: 'system',
    label: 'System operations',
    description: 'Planned maintenance, service degradation, incident notices.',
  },
];

export default function Preferences() {
  const dispatch = useDispatch();
  const toast = useToast();
  const preferences = useNotificationPreferences();

  const [draft, setDraft] = useState(null);
  const [quietHours, setQuietHours] = useState({ start: '', end: '', timezone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Notification Preferences'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Notifications', path: ROUTES.app.notifications.overview },
        {
          label: 'Preferences',
          path: ROUTES.app.notifications.preferences,
        },
      ]),
    );
  }, [dispatch]);

  useEffect(() => {
    if (preferences.preferences) {
      setDraft(preferences.preferences);
    }
    if (preferences.quietHours) {
      setQuietHours({
        start: preferences.quietHours.start ?? '',
        end: preferences.quietHours.end ?? '',
        timezone:
          preferences.quietHours.timezone ??
          Intl.DateTimeFormat().resolvedOptions().timeZone ??
          'UTC',
      });
    }
  }, [preferences.preferences, preferences.quietHours]);

  if (preferences.isLoading || !draft) {
    return <LoadingState label="Loading preferences" />;
  }

  const updateChannel = (channelKey, categoryKey, value) => {
    setDraft((prev) => ({
      ...prev,
      [categoryKey]: {
        ...(prev[categoryKey] ?? {}),
        [channelKey]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await preferences.updatePreferences(draft);
      await preferences.updateQuietHours(quietHours);
      toast.success('Preferences saved');
    } catch (err) {
      toast.error('Save failed', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.notifications.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Notification Preferences
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure delivery channels and categories. Mandatory security and safety alerts
          cannot be disabled.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery channels by category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px]">
              <thead className="bg-muted/40">
                <tr>
                  <th className="border-b border-border px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Category
                  </th>
                  {CHANNELS.map((channel) => (
                    <th
                      key={channel.key}
                      className="border-b border-border px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {channel.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((category) => (
                  <tr
                    key={category.key}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {category.label}
                          {category.mandatory ? (
                            <span className="ml-2 text-2xs font-normal text-warning">
                              mandatory
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-2xs text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                    </td>
                    {CHANNELS.map((channel) => {
                      const value =
                        category.mandatory
                          ? channel.key !== 'push'
                          : draft[category.key]?.[channel.key] ?? false;
                      return (
                        <td
                          key={channel.key}
                          className="px-4 py-3 text-center"
                        >
                          <input
                            type="checkbox"
                            checked={value}
                            disabled={category.mandatory}
                            onChange={(e) =>
                              updateChannel(category.key, channel.key, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-input text-primary focus:ring-ring disabled:opacity-60"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quiet hours</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quiet-start">Start time</Label>
            <Input
              id="quiet-start"
              type="time"
              value={quietHours.start}
              onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quiet-end">End time</Label>
            <Input
              id="quiet-end"
              type="time"
              value={quietHours.end}
              onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quiet-tz">Timezone</Label>
            <Input
              id="quiet-tz"
              value={quietHours.timezone}
              onChange={(e) => setQuietHours({ ...quietHours, timezone: e.target.value })}
            />
          </div>
          <p className="col-span-full text-2xs text-muted-foreground">
            Non-urgent notifications are held and delivered after quiet hours. Critical security
            and safety alerts follow the mandatory policy and are not delayed.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.notifications.overview}>Cancel</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { InfoCallout } from '../../components/ui/InfoCallout.jsx';
import { useDeveloperApplication } from '../../hooks/useDeveloper.js';
import { developerApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Webhooks() {
  const { applicationId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const appQuery = useDeveloperApplication(applicationId);
  const { application, webhooks, isLoading, error } = appQuery;

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    url: '',
    eventTypes: ['order.filled'],
    secret: '',
  });

  const [availableEvents, setAvailableEvents] = useState([]);

  useEffect(() => {
    if (application) {
      dispatch(uiActions.setPageTitle(`${application.name} · Webhooks`));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Developer', path: ROUTES.app.developer.overview },
          { label: 'Applications', path: ROUTES.app.developer.applications },
          {
            label: application.name,
            path: ROUTES.app.developer.application(application.id),
          },
          {
            label: 'Webhooks',
            path: ROUTES.app.developer.webhooks(application.id),
          },
        ]),
      );
      setAvailableEvents(application.availableWebhookEvents ?? []);
    }
  }, [application, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading webhooks" />;
  }

  if (error || !application) {
    return (
      <ErrorState
        title="Unable to load webhooks"
        description="The application or its webhooks could not be retrieved."
        onRetry={appQuery.refetch}
      />
    );
  }

  const handleCreate = async () => {
    if (!form.url.trim()) {
      toast.error('URL is required');
      return;
    }
    if (form.eventTypes.length === 0) {
      toast.error('Select at least one event type');
      return;
    }
    setCreating(true);
    try {
      await developerApi.createWebhook(applicationId, {
        url: form.url.trim(),
        eventTypes: form.eventTypes,
      });
      toast.success('Webhook created', {
        description: 'The endpoint will be verified before activation.',
      });
      setCreateOpen(false);
      setForm({ url: '', eventTypes: ['order.filled'], secret: '' });
      await appQuery.refetch?.();
    } catch (err) {
      toast.error('Failed to create webhook', { description: getErrorMessage(err) });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (webhook) => {
    try {
      await appQuery.deleteWebhook(webhook.id);
      toast.success('Webhook removed');
    } catch (err) {
      toast.error('Delete failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.developer.application(applicationId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Webhook Subscriptions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deliveries are signed with a dedicated secret and retried with bounded backoff.
            Order is not guaranteed and deliveries may be duplicated — applications must
            deduplicate on the event ID.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New subscription
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No webhook subscriptions yet. Create one to receive events at your endpoint.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {webhook.url}
                    </p>
                    <Badge
                      variant={
                        webhook.status === 'active'
                          ? 'success'
                          : webhook.status === 'suspended'
                            ? 'destructive'
                            : 'warning'
                      }
                      className="mt-1.5"
                    >
                      {webhook.status ?? 'pending_verification'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(webhook.eventTypes ?? []).slice(0, 4).map((eventType) => (
                    <span
                      key={eventType}
                      className="rounded-full border border-border bg-muted/30 px-2 py-0.5 font-mono text-2xs text-muted-foreground"
                    >
                      {eventType}
                    </span>
                  ))}
                  {webhook.eventTypes?.length > 4 ? (
                    <span className="text-2xs text-muted-foreground">
                      +{webhook.eventTypes.length - 4} more
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex justify-between border-t border-border pt-2 text-2xs text-muted-foreground">
                  <span>
                    {webhook.lastDeliveryAt
                      ? `Last delivery ${formatRelativeTime(webhook.lastDeliveryAt)}`
                      : 'No deliveries'}
                  </span>
                  <Link
                    to={ROUTES.app.developer.webhook(applicationId, webhook.id)}
                    className="text-primary hover:underline"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New webhook subscription"
        description="The destination must be HTTPS and publicly reachable. It will be verified before activation."
      >
        <div className="flex flex-col gap-4">
          <FormField label="URL" htmlFor="wh-url" required>
            <Input
              id="wh-url"
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://your-app.example.com/webhooks/syncexc"
            />
          </FormField>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Event types
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableEvents.map((event) => {
                const selected = form.eventTypes.includes(event.name);
                return (
                  <button
                    key={event.name}
                    type="button"
                    onClick={() => {
                      const next = selected
                        ? form.eventTypes.filter((e) => e !== event.name)
                        : [...form.eventTypes, event.name];
                      setForm({ ...form, eventTypes: next });
                    }}
                    className={`rounded-full border px-2.5 py-1 font-mono text-2xs transition ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {event.name}
                  </button>
                );
              })}
            </div>
          </div>

          <InfoCallout>
            Delivery is generally at-least-once and order is not guaranteed unless explicitly
            stated. Applications should verify the signature on each delivery and deduplicate
            events using their unique event ID.
          </InfoCallout>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create subscription'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
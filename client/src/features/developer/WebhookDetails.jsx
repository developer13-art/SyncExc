import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { CopyButton } from '../../components/ui/CopyButton.jsx';
import { DeliveryLog } from './components/DeliveryLog.jsx';
import { useDeveloperApplication, useWebhookDeliveries } from '../../hooks/useDeveloper.js';
import { useQuery } from '@tanstack/react-query';
import { developerApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WebhookDetails() {
  const { applicationId, subscriptionId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const appQuery = useDeveloperApplication(applicationId);
  const deliveriesQuery = useWebhookDeliveries(applicationId, subscriptionId, {});

  const webhookQuery = useQuery({
    queryKey: queryKeys.developer.webhook(applicationId, subscriptionId),
    queryFn: () => developerApi.getWebhook(applicationId, subscriptionId),
    enabled: Boolean(applicationId) && Boolean(subscriptionId),
  });

  const [rotateOpen, setRotateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [replayingId, setReplayingId] = useState(null);
  const [newSecret, setNewSecret] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (webhookQuery.data) {
      dispatch(uiActions.setPageTitle('Webhook Details'));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Developer', path: ROUTES.app.developer.overview },
          { label: 'Applications', path: ROUTES.app.developer.applications },
          {
            label: appQuery.application?.name ?? 'Application',
            path: ROUTES.app.developer.application(applicationId),
          },
          {
            label: 'Webhooks',
            path: ROUTES.app.developer.webhooks(applicationId),
          },
          {
            label: 'Details',
            path: ROUTES.app.developer.webhook(applicationId, subscriptionId),
          },
        ]),
      );
    }
  }, [webhookQuery.data, appQuery.application, dispatch, applicationId, subscriptionId]);

  if (webhookQuery.isLoading) {
    return <LoadingState label="Loading webhook" />;
  }

  if (webhookQuery.error || !webhookQuery.data) {
    return (
      <ErrorState
        title="Unable to load webhook"
        description="This webhook could not be retrieved."
        onRetry={webhookQuery.refetch}
      />
    );
  }

  const webhook = webhookQuery.data;

  const handleRotateSecret = async () => {
    setProcessing(true);
    try {
      const result = await developerApi.rotateWebhookSecret(applicationId, subscriptionId);
      setNewSecret(result);
      toast.success('Signing secret rotated');
      webhookQuery.refetch();
    } catch (err) {
      toast.error('Rotation failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
      setRotateOpen(false);
    }
  };

  const handleDelete = async () => {
    setProcessing(true);
    try {
      await developerApi.deleteWebhook(applicationId, subscriptionId);
      toast.success('Subscription removed');
      window.location.assign(ROUTES.app.developer.webhooks(applicationId));
    } catch (err) {
      toast.error('Delete failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
      setDeleteOpen(false);
    }
  };

  const handleReplay = async (delivery) => {
    setReplayingId(delivery.id);
    try {
      await deliveriesQuery.replayDelivery({ deliveryId: delivery.id });
      toast.success('Replay requested');
    } catch (err) {
      toast.error('Replay failed', { description: getErrorMessage(err) });
    } finally {
      setReplayingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.developer.webhooks(applicationId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {webhook.url}
            </h1>
            <Badge
              variant={
                webhook.status === 'active'
                  ? 'success'
                  : webhook.status === 'suspended'
                    ? 'destructive'
                    : 'warning'
              }
            >
              {webhook.status ?? 'pending'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">
            {webhook.id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRotateOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Rotate secret
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </div>
      </div>

      {newSecret ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-4 pt-4">
            <p className="text-sm font-semibold text-warning">
              New signing secret — copy now
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {newSecret.secret}
              </code>
              <CopyButton value={newSecret.secret} />
            </div>
            <p className="text-xs text-muted-foreground">
              Update your endpoint verification before the overlap expires.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setNewSecret(null)}>
                I have saved the secret
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field
            label="Last success"
            value={
              webhook.lastSuccessAt ? formatDateTime(webhook.lastSuccessAt) : '—'
            }
          />
          <Field
            label="Last failure"
            value={
              webhook.lastFailureAt ? formatDateTime(webhook.lastFailureAt) : '—'
            }
          />
          <Field
            label="Retry policy"
            value={webhook.retryPolicy ?? 'exponential_bounded'}
          />
          <Field
            label="Last secret rotated"
            value={
              webhook.lastSecretRotationAt
                ? formatDateTime(webhook.lastSecretRotationAt)
                : '—'
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event types</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {(webhook.eventTypes ?? []).map((eventType) => (
            <span
              key={eventType}
              className="rounded-full border border-border bg-muted/30 px-2 py-0.5 font-mono text-2xs text-muted-foreground"
            >
              {eventType}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent deliveries</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deliveriesQuery.refetch?.()}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DeliveryLog
            deliveries={deliveriesQuery.deliveries}
            isLoading={deliveriesQuery.isLoading}
            onReplay={handleReplay}
            replayingId={replayingId}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Rotate signing secret?"
        description="Your endpoint must verify the new signature after the overlap window. During the overlap, deliveries may be signed with either the old or new secret."
        confirmLabel="Rotate secret"
        variant="warning"
        onConfirm={handleRotateSecret}
        isLoading={processing}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove subscription?"
        description="The endpoint will no longer receive events. Historical delivery records are retained for audit."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={processing}
      />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
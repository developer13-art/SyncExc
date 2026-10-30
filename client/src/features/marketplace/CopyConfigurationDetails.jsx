import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, PauseCircle, PlayCircle, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { useCopyConfiguration } from '../../hooks/useMarketplace.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CopyConfigurationDetails() {
  const { configId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const configQuery = useCopyConfiguration(configId);
  const { configuration, destinations, isLoading, error } = configQuery;

  const [pauseOpen, setPauseOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (configuration) {
      dispatch(uiActions.setPageTitle(configuration.name));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
          {
            label: 'Copy configurations',
            path: ROUTES.app.marketplace.copyConfigurations,
          },
          {
            label: configuration.name,
            path: ROUTES.app.marketplace.copyConfiguration(configuration.id),
          },
        ]),
      );
    }
  }, [configuration, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading configuration" />;
  }

  if (error || !configuration) {
    return (
      <ErrorState
        title="Unable to load configuration"
        description="This copy configuration could not be retrieved."
        onRetry={configQuery.refetch}
      />
    );
  }

  const isActive = configuration.status === 'active';
  const isPaused = configuration.status === 'paused';
  const isDraft = configuration.status === 'draft';

  const handleActivate = async () => {
    setProcessing(true);
    try {
      await configQuery.activateConfiguration();
      toast.success('Copy configuration activated');
      setActivateOpen(false);
    } catch (err) {
      toast.error('Activation failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };
  const handlePause = async () => {
    setProcessing(true);
    try {
      await configQuery.pauseConfiguration?.({ configId, reason: 'Manual pause' });
      toast.success('Configuration paused');
      setPauseOpen(false);
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  const handleResume = async () => {
    setProcessing(true);
    try {
      await configQuery.activateConfiguration?.({
        configId,
        reason: 'Manual resume',
      });
      toast.success('Configuration activated');
    } catch (err) {
      toast.error('Activation failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  const handleRevoke = async () => {
    setProcessing(true);
    try {
      await configQuery.revokeConfiguration?.({
        configId,
        reason: 'Manual revocation',
      });
      toast.success('Configuration revoked');
      setRevokeOpen(false);
    } catch (err) {
      toast.error('Revoke failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.marketplace.copyConfigurations}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {configuration.name}
            </h1>
            <Badge
              variant={
                isActive ? 'success' : isPaused ? 'warning' : 'muted'
              }
            >
              {configuration.status ?? 'draft'}
            </Badge>
          </div>
          {configuration.providerName ? (
            <p className="mt-1 text-sm text-muted-foreground">
              From{' '}
              <Link
                to={ROUTES.app.marketplace.provider(configuration.providerId)}
                className="text-primary hover:underline"
              >
                {configuration.providerName}
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <Button onClick={() => setActivateOpen(true)} disabled={processing}>
              <PlayCircle className="h-4 w-4" /> Activate copying
            </Button>
          ) : isActive ? (
            <Button
              variant="outline"
              onClick={() => setPauseOpen(true)}
              disabled={processing}
            >
              <PauseCircle className="h-4 w-4" /> Pause
            </Button>
          ) : isPaused ? (
            <Button onClick={handleResume} disabled={processing}>
              <PlayCircle className="h-4 w-4" /> Resume
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => setRevokeOpen(true)}
            disabled={processing}
          >
            <XCircle className="h-4 w-4" /> Revoke
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field
            label="Sizing"
            value={configuration.sizingRule?.type?.replace(/_/g, ' ') ?? '—'}
          />
          <Field
            label="Sizing value"
            value={
              configuration.sizingRule?.type === 'fixed_percentage'
                ? `${configuration.sizingRule.config?.percentage ?? '—'}%`
                : configuration.sizingRule?.config?.amount ?? '—'
            }
          />
          <Field
            label="Stop-loss override"
            value={configuration.stopLossPercent == null
              ? 'Provider signal'
              : `${configuration.stopLossPercent}% from reference price`}
          />
          <Field
            label="Take-profit override"
            value={configuration.takeProfitPercent == null
              ? 'Provider signal'
              : `${configuration.takeProfitPercent}% from reference price`}
          />
          <Field
            label="Execution mode"
            value={configuration.executionMode?.replace(/_/g, ' ') ?? '—'}
          />
          <Field
            label="Max open positions"
            value={configuration.maxOpenPositions ?? '—'}
          />
          <Field
            label="Destinations"
            value={destinations.length}
          />
          <Field
            label="Created"
            value={
              configuration.createdAt ? formatDateTime(configuration.createdAt) : '—'
            }
          />
        </CardContent>
      </Card>

      {configuration.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{configuration.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        title="Activate this copy configuration?"
        description="New eligible signals can create copy intents for its selected exchange accounts. A copy order you submit from a signal will still pass SyncExc permissions and risk checks."
        confirmLabel="Activate copying"
        onConfirm={handleActivate}
        isLoading={processing}
      />

      <ConfirmDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        title="Pause copying?"
        description="New eligible signals will not create copying intents. Existing exchange orders are not affected."
        confirmLabel="Pause"
        variant="warning"
        onConfirm={handlePause}
        isLoading={processing}
      />

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke configuration?"
        description="Revoking stops all future copying from this configuration. Historical records are preserved for audit."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevoke}
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
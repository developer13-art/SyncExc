import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ArrowRight, MoreVertical, PauseCircle, PlayCircle, Plus, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../../components/ui/Dropdown.jsx';
import { useCopyConfigurations } from '../../hooks/useMarketplace.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CopyConfigurations() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [pauseTarget, setPauseTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Copy Configurations'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
        {
          label: 'Copy configurations',
          path: ROUTES.app.marketplace.copyConfigurations,
        },
      ]),
    );
  }, [dispatch]);

  const configsQuery = useCopyConfigurations({});
  const { configurations, isLoading, isError, refetch, pauseConfiguration, revokeConfiguration } =
    configsQuery;

  const handlePause = async () => {
    if (!pauseTarget) {
      return;
    }
    setProcessing(true);
    try {
      await pauseConfiguration({ configId: pauseTarget.id, reason: 'Paused from list' });
      toast.success('Configuration paused');
      setPauseTarget(null);
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) {
      return;
    }
    setProcessing(true);
    try {
      await revokeConfiguration({ configId: revokeTarget.id, reason: 'Revoked from list' });
      toast.success('Configuration revoked');
      setRevokeTarget(null);
    } catch (err) {
      toast.error('Revoke failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Copy Configurations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each configuration defines which provider signals may be considered for copying,
            to which authorized accounts, with what sizing. Every proposed destination
            operation remains subject to risk controls.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.app.marketplace.createCopyConfiguration}>
            <Plus className="h-4 w-4" /> New configuration
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <LoadingState label="Loading configurations" />
      ) : isError ? (
        <ErrorState
          title="Unable to load configurations"
          description="We could not fetch your copy configurations."
          onRetry={refetch}
        />
      ) : configurations.length === 0 ? (
        <EmptyState
          icon={ArrowRight}
          title="No copy configurations"
          description="Configure copying to consider eligible provider signals for your authorized destination accounts."
          action={
            <Button asChild>
              <Link to={ROUTES.app.marketplace.createCopyConfiguration}>
                Create configuration
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {configurations.map((config) => (
            <Card key={config.id} className="overflow-hidden transition hover:border-primary/40">
              <div className="flex items-start justify-between gap-3 p-4">
                <Link
                  to={ROUTES.app.marketplace.copyConfiguration(config.id)}
                  className="min-w-0 flex-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {config.name}
                    </p>
                    <Badge variant={statusVariant(config.status)}>
                      {config.status ?? 'draft'}
                    </Badge>
                  </div>
                  {config.providerName ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      From {config.providerName}
                    </p>
                  ) : null}
                </Link>

                <DropdownMenu>
                  <DropdownTrigger asChild>
                    <IconButton label="Actions" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </IconButton>
                  </DropdownTrigger>
                  <DropdownContent align="end">
                    <DropdownItem asChild>
                      <Link to={ROUTES.app.marketplace.copyConfiguration(config.id)}>
                        View details
                      </Link>
                    </DropdownItem>
                    <DropdownSeparator />
                    {config.status === 'active' ? (
                      <DropdownItem onSelect={() => setPauseTarget(config)}>
                        <PauseCircle className="h-3.5 w-3.5" /> Pause
                      </DropdownItem>
                    ) : config.status === 'paused' ? (
                      <DropdownItem
                        onSelect={() => configsQuery.activateConfiguration?.({ configId: config.id })}
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Resume
                      </DropdownItem>
                    ) : null}
                    <DropdownItem
                      onSelect={() => setRevokeTarget(config)}
                      className="text-destructive focus:text-destructive"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Revoke
                    </DropdownItem>
                  </DropdownContent>
                </DropdownMenu>
              </div>

              <Link
                to={ROUTES.app.marketplace.copyConfiguration(config.id)}
                className="block border-t border-border px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-muted-foreground">
                    {config.destinationAccountCount ?? 0} destination
                    {(config.destinationAccountCount ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {config.sizingType ? (
                    <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-muted-foreground">
                      {config.sizingType.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-2xs text-muted-foreground">
                  {config.lastActivityAt
                    ? `Last activity ${formatRelativeTime(config.lastActivityAt)}`
                    : 'No recent activity'}
                </p>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pauseTarget)}
        onOpenChange={(open) => !open && setPauseTarget(null)}
        title="Pause copying?"
        description="New eligible signals will not create copying intents. Existing exchange orders are not affected."
        confirmLabel="Pause"
        variant="warning"
        onConfirm={handlePause}
        isLoading={processing}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
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

function statusVariant(status) {
  if (status === 'active') {
    return 'success';
  }
  if (status === 'paused') {
    return 'warning';
  }
  if (status === 'revoked' || status === 'needs_attention') {
    return 'destructive';
  }
  return 'muted';
}
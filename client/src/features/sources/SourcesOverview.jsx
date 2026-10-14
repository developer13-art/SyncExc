import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, Rss } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SourceCard } from './components/SourceCard.jsx';
import { useSources } from '../../hooks/useSources.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_review', label: 'Review' },
  { value: 'paused', label: 'Paused' },
  { value: 'needs_attention', label: 'Attention' },
];

export default function SourcesOverview() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [pauseTarget, setPauseTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Signal Sources'));
    dispatch(
      uiActions.setBreadcrumbs([{ label: 'Sources', path: ROUTES.app.sources.overview }]),
    );
  }, [dispatch]);

  const { sources, isLoading, isError, refetch, pauseSource, revalidate, archive } =
    useSources({
      status: status === 'all' ? undefined : status,
      q: query || undefined,
    });

  const handlePause = async () => {
    if (!pauseTarget) {
      return;
    }
    setProcessing(true);
    try {
      await pauseSource({ sourceId: pauseTarget.id, reason: 'Paused from overview' });
      toast.success('Source paused');
      setPauseTarget(null);
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) {
      return;
    }
    setProcessing(true);
    try {
      await archive({ sourceId: removeTarget.id, reason: 'Archived from overview' });
      toast.success('Source archived');
      setRemoveTarget(null);
    } catch (err) {
      toast.error('Archive failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  const handleRevalidate = async (source) => {
    try {
      await revalidate({ sourceId: source.id });
      toast.success('Revalidation started');
    } catch (err) {
      toast.error('Revalidation failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Signal Sources
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registered sources with authorized access, validation history, and health
            monitoring. Registration, technical activation, quality approval, and downstream
            use are separate states.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.sources.discovery}>Discover</Link>
          </Button>
          <Button asChild>
            <Link to={ROUTES.app.sources.create}>
              <Plus className="h-4 w-4" /> Add source
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search sources…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
      </div>

      {isLoading ? (
        <LoadingState label="Loading sources" />
      ) : isError ? (
        <ErrorState
          title="Unable to load sources"
          description="We could not fetch your sources. Please try again."
          onRetry={refetch}
        />
      ) : sources.length === 0 ? (
        <EmptyState
          icon={Rss}
          title={query || status !== 'all' ? 'No matching sources' : 'No sources yet'}
          description={
            query || status !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Add a supported source manually or discover candidates through the AI-assisted workflow.'
          }
          action={
            !query && status === 'all' ? (
              <Button asChild>
                <Link to={ROUTES.app.sources.create}>Register source</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onPause={setPauseTarget}
              onRevalidate={handleRevalidate}
              onRemove={setRemoveTarget}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pauseTarget)}
        onOpenChange={(open) => !open && setPauseTarget(null)}
        title="Pause source?"
        description="New ingestion and downstream eligibility are stopped according to the pause policy. Existing exchange orders are not affected."
        confirmLabel="Pause source"
        variant="warning"
        onConfirm={handlePause}
        isLoading={processing}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Archive source?"
        description="Archiving preserves history for audit but removes the source from active configuration."
        confirmLabel="Archive source"
        variant="destructive"
        onConfirm={handleRemove}
        isLoading={processing}
      />
    </div>
  );
}
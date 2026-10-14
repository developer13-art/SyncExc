import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { SignalCard } from './components/SignalCard.jsx';
import { useSignals } from '../../hooks/useSignals.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'eligible', label: 'Eligible' },
  { value: 'review_required', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'executed', label: 'Executed' },
];

export default function SignalsOverview() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Signals'));
    dispatch(
      uiActions.setBreadcrumbs([{ label: 'Signals', path: ROUTES.app.signals.overview }]),
    );
  }, [dispatch]);

  const signalsQuery = useSignals({
    status: status === 'all' ? undefined : status,
    q: query || undefined,
  });

  const signals = signalsQuery.data?.items ?? [];

  const eligibleCount = signals.filter((s) => s.status === 'eligible').length;
  const reviewCount = signals.filter((s) => s.status === 'review_required').length;
  const blockedCount = signals.filter((s) => s.status === 'blocked').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Signals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured signal records produced from approved sources. AI interprets; deterministic
            rules validate; the risk engine decides whether to proceed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.signals.messages}>Messages</Link>
          </Button>
          <Button asChild>
            <Link to={ROUTES.app.signals.reviewQueue}>Review queue</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total signals" value={signals.length} />
        <StatCard label="Eligible" value={eligibleCount} tone="success" />
        <StatCard label="Review required" value={reviewCount} tone="warning" />
        <StatCard label="Blocked" value={blockedCount} tone="destructive" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search signals…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
      </div>

      {signalsQuery.isLoading ? (
        <LoadingState label="Loading signals" />
      ) : signalsQuery.isError ? (
        <ErrorState
          title="Unable to load signals"
          description="We could not fetch signal records."
          onRetry={signalsQuery.refetch}
        />
      ) : signals.length === 0 ? (
        <EmptyState
          icon={Radio}
          title={query || status !== 'all' ? 'No matching signals' : 'No signals yet'}
          description={
            query || status !== 'all'
              ? 'Try adjusting your filters.'
              : 'Signals processed from your approved sources will appear here.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}
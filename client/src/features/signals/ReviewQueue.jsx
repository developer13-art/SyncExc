import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ClipboardList } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SignalCard } from './components/SignalCard.jsx';
import { useSignalReviews } from '../../hooks/useSignals.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function ReviewQueue() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Signal Review Queue'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Signals', path: ROUTES.app.signals.overview },
        { label: 'Review queue', path: ROUTES.app.signals.reviewQueue },
      ]),
    );
  }, [dispatch]);

  const signalsQuery = useSignalReviews({});
  const signals = signalsQuery.signals ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Review Queue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signals flagged for review — typically due to missing, ambiguous, or contradictory
          data. AI never invents missing values; those cases are routed here.
        </p>
      </div>

      {signalsQuery.isLoading ? (
        <LoadingState label="Loading review queue" />
      ) : signalsQuery.isError ? (
        <ErrorState
          title="Unable to load review queue"
          description="We could not fetch signals requiring review."
          onRetry={signalsQuery.refetch}
        />
      ) : signals.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Review queue is empty"
          description="No signals currently require human review."
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
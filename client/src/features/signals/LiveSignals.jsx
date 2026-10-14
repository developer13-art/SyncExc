import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Radio } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { SignalCard } from './components/SignalCard.jsx';
import { useSignals } from '../../hooks/useSignals.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function LiveSignals() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Live Signals'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Signals', path: ROUTES.app.signals.overview },
        { label: 'Live', path: ROUTES.app.signals.live },
      ]),
    );
  }, [dispatch]);

  const signalsQuery = useSignals({ live: true, limit: 50 });
  const signals = signalsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="live-indicator" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Live Signals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signals being processed in real time. This page auto-refreshes as new messages are
            interpreted.
          </p>
        </div>
      </div>

      {signalsQuery.isLoading ? (
        <LoadingState label="Loading live signals" />
      ) : signalsQuery.isError ? (
        <ErrorState
          title="Unable to load live signals"
          description="We could not fetch the live feed."
          onRetry={signalsQuery.refetch}
        />
      ) : signals.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No live signals"
          description="Newly processed signals will appear here as they arrive."
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 pt-5">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
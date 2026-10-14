import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { JsonViewer } from '../../components/ui/JsonViewer.jsx';
import { ReplayControls } from './components/ReplayControls.jsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import { simulationApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { ROUTES } from '../../config/routes.config.js';

export default function ReplaySession() {
  const { replayId } = useParams();
  const toast = useToast();

  const replayQuery = useQuery({
    queryKey: queryKeys.simulation.replay(replayId),
    queryFn: () => simulationApi.getReplay(replayId),
    enabled: Boolean(replayId),
    refetchInterval: 5_000,
  });

  const [state, setState] = useState({
    status: 'idle',
    speed: 1,
    progress: 0,
    currentTime: null,
    endTime: null,
    currentEventIndex: 0,
    totalEvents: 0,
    processedEvents: 0,
  });

  useEffect(() => {
    if (replayQuery.data) {
      setState((prev) => ({ ...prev, ...replayQuery.data }));
    }
  }, [replayQuery.data]);

  const seek = useMutation({
    mutationFn: (progress) => simulationApi.seekReplay(replayId, { progress }),
    onSuccess: (data) => setState((prev) => ({ ...prev, ...data })),
    onError: (err) => toast.error('Seek failed', { description: getErrorMessage(err) }),
  });

  const step = useMutation({
    mutationFn: () => simulationApi.stepReplay(replayId),
    onSuccess: (data) => setState((prev) => ({ ...prev, ...data })),
    onError: (err) => toast.error('Step failed', { description: getErrorMessage(err) }),
  });

  if (replayQuery.isLoading) {
    return <LoadingState label="Loading replay" />;
  }

  if (replayQuery.error || !replayQuery.data) {
    return (
      <ErrorState
        title="Unable to load replay"
        description="This replay could not be retrieved."
        onRetry={replayQuery.refetch}
      />
    );
  }

  const replay = replayQuery.data;

  const handlePlay = () => {
    setState((prev) => ({ ...prev, status: 'playing' }));
    replayQuery.refetch();
  };

  const handlePause = () => {
    setState((prev) => ({ ...prev, status: 'paused' }));
    replayQuery.refetch();
  };

  const handleStop = () => {
    setState((prev) => ({ ...prev, status: 'idle', progress: 0 }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.simulation.replays}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {replay.name ?? 'Replay'}
            </h1>
            <Badge variant={state.status === 'playing' ? 'info' : 'muted'}>
              {state.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {replay.datasetName ? `Dataset: ${replay.datasetName}` : ''}
          </p>
        </div>
      </div>

      <ReplayControls
        state={state}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onStep={() => step.mutate()}
        onSpeedChange={(speed) => setState((prev) => ({ ...prev, speed }))}
        onSeek={(progress) => seek.mutate(progress)}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current event</CardTitle>
          </CardHeader>
          <CardContent>
            {replay.currentEvent ? (
              <JsonViewer data={replay.currentEvent} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No event loaded yet. Press play or step to advance.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing result</CardTitle>
          </CardHeader>
          <CardContent>
            {replay.currentResult ? (
              <JsonViewer data={replay.currentResult} />
            ) : (
              <p className="text-sm text-muted-foreground">
                The processing result for the current event will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {replay.snapshot ? (
        <Card>
          <CardHeader>
            <CardTitle>Simulated state at current point</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonViewer data={replay.snapshot} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
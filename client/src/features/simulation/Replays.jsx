import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Play, Plus } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { useSimulationReplays } from '../../hooks/useSimulation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Replays() {
  const dispatch = useDispatch();
  const toast = useToast();
  const { replays, isLoading, isError, refetch, startReplay } = useSimulationReplays({});

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', datasetId: '', startAt: '', endAt: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Market Replays'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Simulation', path: ROUTES.app.simulation.overview },
        { label: 'Replays', path: ROUTES.app.simulation.replays },
      ]),
    );
  }, [dispatch]);

  const handleStart = async () => {
    setSubmitting(true);
    try {
      const replay = await startReplay({
        name: form.name.trim() || 'Untitled replay',
        datasetId: form.datasetId,
        startAt: form.startAt,
        endAt: form.endAt,
      });
      toast.success('Replay started');
      setCreateOpen(false);
      await refetch();
      // eslint-disable-next-line no-undef
      window.location.assign(ROUTES.app.simulation.replay(replay.id));
    } catch (err) {
      toast.error('Failed to start replay', { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Market Replays
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reconstruct chronological event sequences with adjustable speed. Replays preserve
            their original dataset and configuration versions.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New replay
        </Button>
      </div>

      {isLoading ? (
        <LoadingState label="Loading replays" />
      ) : isError ? (
        <ErrorState
          title="Unable to load replays"
          description="We could not fetch your replays."
          onRetry={refetch}
        />
      ) : replays.length === 0 ? (
        <EmptyState
          icon={Play}
          title="No replays yet"
          description="Create a replay to review how a configuration responds to historical events."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {replays.map((replay) => (
            <Card key={replay.id} className="overflow-hidden transition hover:border-primary/40">
              <Link to={ROUTES.app.simulation.replay(replay.id)} className="block p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {replay.name ?? 'Replay'}
                  </p>
                  <Badge variant={replay.status === 'playing' ? 'info' : 'muted'}>
                    {replay.status ?? 'idle'}
                  </Badge>
                </div>
                {replay.datasetName ? (
                  <p className="mt-1 text-xs text-muted-foreground">{replay.datasetName}</p>
                ) : null}
                <p className="mt-2 text-2xs text-muted-foreground">
                  {replay.lastActivityAt
                    ? `Last activity ${formatRelativeTime(replay.lastActivityAt)}`
                    : 'Not started'}
                </p>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Start a replay"
        description="Choose a dataset and time range. Playback begins at the start timestamp."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={submitting || !form.datasetId}>
              {submitting ? 'Starting…' : 'Start replay'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Replay name" htmlFor="replay-name">
            <Input
              id="replay-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Replay 2026-10-01"
            />
          </FormField>
          <FormField label="Dataset ID" htmlFor="replay-dataset" required>
            <Input
              id="replay-dataset"
              value={form.datasetId}
              onChange={(e) => setForm({ ...form, datasetId: e.target.value })}
              placeholder="dataset-id"
            />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Start at" htmlFor="replay-start">
              <Input
                id="replay-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </FormField>
            <FormField label="End at" htmlFor="replay-end">
              <Input
                id="replay-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </FormField>
          </div>
        </div>
      </Modal>
    </div>
  );
}
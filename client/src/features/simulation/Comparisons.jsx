import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { ComparisonView } from './components/ComparisonView.jsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import { simulationApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Comparisons() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [runIds, setRunIds] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeComparison, setActiveComparison] = useState(null);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Run Comparisons'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Simulation', path: ROUTES.app.simulation.overview },
        { label: 'Comparisons', path: ROUTES.app.simulation.comparisons },
      ]),
    );
  }, [dispatch]);

  const comparisonsQuery = useQuery({
    queryKey: queryKeys.simulation.comparisons({}),
    queryFn: () => simulationApi.listComparisons({}),
  });

  const comparisonDetailQuery = useQuery({
    queryKey: queryKeys.simulation.comparison(activeComparison),
    queryFn: () => simulationApi.getComparison(activeComparison),
    enabled: Boolean(activeComparison),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => simulationApi.createComparison(payload),
    onSuccess: (comparison) => {
      toast.success('Comparison created');
      setCreateOpen(false);
      setRunIds('');
      setActiveComparison(comparison.id);
      comparisonsQuery.refetch();
    },
    onError: (err) =>
      toast.error('Comparison failed', { description: getErrorMessage(err) }),
  });

  const handleCreate = () => {
    const ids = runIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length < 2) {
      toast.error('Provide at least two run IDs');
      return;
    }
    setSubmitting(true);
    createMutation.mutate(
      { runIds: ids },
      { onSettled: () => setSubmitting(false) },
    );
  };

  const comparisons = comparisonsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Run Comparisons
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare runs using the same reporting definitions. Incompatible datasets or
            calculation methods are flagged rather than merged silently.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New comparison
        </Button>
      </div>

      {activeComparison && comparisonDetailQuery.data ? (
        <ComparisonView comparison={comparisonDetailQuery.data} />
      ) : null}

      {comparisonsQuery.isLoading ? (
        <LoadingState label="Loading comparisons" />
      ) : comparisonsQuery.isError ? (
        <ErrorState
          title="Unable to load comparisons"
          description="We could not fetch your comparisons."
          onRetry={comparisonsQuery.refetch}
        />
      ) : comparisons.length === 0 ? (
        <EmptyState
          title="No comparisons yet"
          description="Create a comparison to review differences between simulation runs."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {comparisons.map((comparison) => (
                <li
                  key={comparison.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {comparison.name ?? `Comparison ${comparison.id?.slice(0, 8)}`}
                    </p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {comparison.runCount ?? 0} runs ·{' '}
                      {comparison.createdAt ? comparison.createdAt : ''}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveComparison(comparison.id)}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create comparison"
        description="Provide two or more run IDs, separated by commas."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create comparison'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Run IDs</label>
          <textarea
            value={runIds}
            onChange={(e) => setRunIds(e.target.value)}
            placeholder="run-1, run-2"
            rows={3}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </Modal>
    </div>
  );
}
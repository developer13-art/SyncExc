import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Plus } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import { simulationApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Scenarios() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', parameters: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Scenarios'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Simulation', path: ROUTES.app.simulation.overview },
        { label: 'Scenarios', path: ROUTES.app.simulation.scenarios },
      ]),
    );
  }, [dispatch]);

  const scenariosQuery = useQuery({
    queryKey: queryKeys.simulation.scenarios({}),
    queryFn: () => simulationApi.listScenarios({}),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => simulationApi.createScenario(payload),
    onSuccess: () => {
      toast.success('Scenario created');
      setCreateOpen(false);
      setForm({ name: '', description: '', parameters: '' });
      scenariosQuery.refetch();
    },
    onError: (err) =>
      toast.error('Creation failed', { description: getErrorMessage(err) }),
  });

  const handleCreate = () => {
    let parsedParams = {};
    if (form.parameters) {
      try {
        parsedParams = JSON.parse(form.parameters);
      } catch {
        toast.error('Invalid JSON in parameters');
        return;
      }
    }
    setSubmitting(true);
    createMutation.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim(),
        parameters: parsedParams,
      },
      { onSettled: () => setSubmitting(false) },
    );
  };

  const scenarios = scenariosQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scenarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable failure, latency, and market-condition scenarios for simulation runs.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New scenario
        </Button>
      </div>

      {scenariosQuery.isLoading ? (
        <LoadingState label="Loading scenarios" />
      ) : scenariosQuery.isError ? (
        <ErrorState
          title="Unable to load scenarios"
          description="We could not fetch your scenarios."
          onRetry={scenariosQuery.refetch}
        />
      ) : scenarios.length === 0 ? (
        <EmptyState
          title="No scenarios yet"
          description="Create a scenario to test how configurations respond to controlled conditions."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <Card key={scenario.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-semibold text-foreground">
                  {scenario.name}
                </p>
                <Badge variant="muted">v{scenario.version ?? 1}</Badge>
              </div>
              {scenario.description ? (
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                  {scenario.description}
                </p>
              ) : null}
              {scenario.parameters && Object.keys(scenario.parameters).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(scenario.parameters)
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <span
                        key={key}
                        className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground"
                      >
                        {key}: {String(value)}
                      </span>
                    ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create scenario"
        description="Define parameters for a controlled simulation condition."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !form.name.trim()}>
              {submitting ? 'Creating…' : 'Create scenario'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Name" htmlFor="scenario-name" required>
            <Input
              id="scenario-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Description" htmlFor="scenario-description">
            <Textarea
              id="scenario-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>
          <FormField
            label="Parameters (JSON)"
            htmlFor="scenario-parameters"
            hint='Example: {"latencyMs": 500, "failRate": 0.1}'
          >
            <Textarea
              id="scenario-parameters"
              rows={4}
              value={form.parameters}
              onChange={(e) => setForm({ ...form, parameters: e.target.value })}
              className="font-mono text-xs"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
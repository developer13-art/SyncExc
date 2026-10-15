import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { TagInput } from '../../components/forms/TagInput.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { PlanPriceEditor } from './PlanPriceEditor.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { plansApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

export default function PlanEditor() {
  const { planId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    features: [],
    status: 'draft',
  });
  const [publishOpen, setPublishOpen] = useState(false);
  const [error, setError] = useState(null);

  const planQuery = useQuery({
    queryKey: ['plan', planId],
    queryFn: () => plansApi.get(planId),
    enabled: Boolean(planId),
  });

  useEffect(() => {
    if (planQuery.data) {
      const plan = planQuery.data;
      setForm({
        name: plan.name ?? '',
        description: plan.description ?? '',
        features: Array.isArray(plan.features)
          ? plan.features
          : Object.entries(plan.features ?? {})
              .filter(([, enabled]) => Boolean(enabled))
              .map(([feature]) => feature),
        status: plan.status ?? 'draft',
      });
      dispatch(adminUiActions.setPageTitle(`Edit · ${plan.name}`));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Plans', path: '/plans' },
          { label: plan.name, path: `/plans/${plan.id}` },
        ]),
      );
    }
  }, [planQuery.data, dispatch]);

  const updateMutation = useMutation({
    mutationFn: (payload) => plansApi.update(planId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      toast.success('Plan updated');
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => plansApi.publish(planId, { confirm: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      toast.success('Plan published');
      setPublishOpen(false);
    },
    onError: (err) => {
      toast.error('Publish failed', { description: getErrorMessage(err) });
    },
  });

  const retireMutation = useMutation({
    mutationFn: () => plansApi.retire(planId, { confirm: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      toast.success('Plan retired from new subscriptions');
    },
    onError: (err) => {
      toast.error('Retire failed', { description: getErrorMessage(err) });
    },
  });

  if (planQuery.isLoading) {
    return <LoadingState label="Loading plan" />;
  }

  if (planQuery.error || !planQuery.data) {
    return (
      <ErrorState
        title="Unable to load plan"
        description="This plan could not be retrieved."
        onRetry={planQuery.refetch}
      />
    );
  }

  const plan = planQuery.data;

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Plan name is required');
      return;
    }
    updateMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      features: form.features,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/plans">
            <ArrowLeft className="h-4 w-4" /> Back to plans
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {plan.name}
            </h1>
            <Badge variant={plan.status === 'active' ? 'success' : 'muted'}>
              {plan.status}
            </Badge>
            <Badge variant="muted">v{plan.version ?? 1}</Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">
            {plan.code ?? plan.id}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {plan.status === 'draft' ? (
            <Button onClick={() => setPublishOpen(true)}>
              <Send className="h-4 w-4" /> Publish plan
            </Button>
          ) : plan.status === 'active' ? (
            <Button
              variant="outline"
              onClick={() => retireMutation.mutate()}
              disabled={retireMutation.isPending}
            >
              <XCircle className="h-4 w-4" /> Retire
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Plan name" htmlFor="plan-name" required>
            <Input
              id="plan-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>

          <FormField label="Description" htmlFor="plan-description">
            <Textarea
              id="plan-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>

          <FormField label="Features" htmlFor="plan-features">
            <TagInput
              value={form.features}
              onChange={(features) => setForm({ ...form, features })}
            />
          </FormField>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PlanPriceEditor
        planId={planId}
        prices={plan.prices ?? []}
        features={plan.features ?? {}}
        limits={plan.limits ?? {}}
      />

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish plan?"
        description="Publishing makes this version available for new subscriptions. Existing subscribers retain their agreed price until a valid price-change policy takes effect."
        confirmLabel="Publish plan"
        onConfirm={() => publishMutation.mutate()}
        isLoading={publishMutation.isPending}
      />
    </div>
  );
}
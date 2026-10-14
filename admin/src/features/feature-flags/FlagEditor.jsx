import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { featureFlagsApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

export default function FlagEditor() {
  const { flagId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    description: '',
    owningTeam: '',
    relatedModule: '',
    rollbackProcedure: '',
  });
  const [error, setError] = useState(null);

  const flagQuery = useQuery({
    queryKey: ['feature-flag', flagId],
    queryFn: () => featureFlagsApi.get(flagId),
    enabled: Boolean(flagId),
  });

  useEffect(() => {
    if (flagQuery.data) {
      const flag = flagQuery.data;
      setForm({
        description: flag.description ?? '',
        owningTeam: flag.owningTeam ?? '',
        relatedModule: flag.relatedModule ?? '',
        rollbackProcedure: flag.rollbackProcedure ?? '',
      });
      dispatch(adminUiActions.setPageTitle(flag.key));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Feature Flags', path: '/feature-flags' },
          { label: flag.key, path: `/feature-flags/${flagId}` },
        ]),
      );
    }
  }, [flagQuery.data, dispatch, flagId]);

  const updateMutation = useMutation({
    mutationFn: (payload) => featureFlagsApi.update(flagId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flag', flagId] });
      toast.success('Flag updated');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const publishMutation = useMutation({
    mutationFn: () => featureFlagsApi.publish(flagId, { confirm: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flag', flagId] });
      toast.success('New flag version published');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  if (flagQuery.isLoading) {
    return <LoadingState label="Loading flag" />;
  }

  if (flagQuery.error || !flagQuery.data) {
    return (
      <ErrorState
        title="Unable to load flag"
        description="This feature flag could not be retrieved."
        onRetry={flagQuery.refetch}
      />
    );
  }

  const flag = flagQuery.data;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    updateMutation.mutate(form);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/feature-flags">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-foreground">
              {flag.key}
            </h1>
            <Badge variant={flag.status === 'active' ? 'success' : 'muted'}>
              {flag.status ?? 'inactive'}
            </Badge>
            <Badge variant="muted">{flag.type?.replace(/_/g, ' ')}</Badge>
          </div>
          <p className="mt-1 text-2xs text-muted-foreground">
            Environment: {flag.environment ?? 'production'}
            {flag.owningTeam ? ` · Team: ${flag.owningTeam}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/feature-flags/${flagId}/rollouts`}>Rollouts</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/feature-flags/${flagId}/versions`}>Versions</Link>
          </Button>
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            <Send className="h-4 w-4" />
            {publishMutation.isPending ? 'Publishing…' : 'Publish new version'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <FormError>{error}</FormError>

          <Card>
            <CardHeader>
              <CardTitle>Flag metadata</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField label="Description" htmlFor="flag-description">
                <Textarea
                  id="flag-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Owning team" htmlFor="flag-team">
                  <Input
                    id="flag-team"
                    value={form.owningTeam}
                    onChange={(e) => setForm({ ...form, owningTeam: e.target.value })}
                  />
                </FormField>
                <FormField label="Related module" htmlFor="flag-module">
                  <Input
                    id="flag-module"
                    value={form.relatedModule}
                    onChange={(e) => setForm({ ...form, relatedModule: e.target.value })}
                  />
                </FormField>
              </div>

              <FormField
                label="Rollback procedure"
                htmlFor="flag-rollback"
                hint="Documented steps to roll back this flag if needed."
              >
                <Textarea
                  id="flag-rollback"
                  rows={3}
                  value={form.rollbackProcedure}
                  onChange={(e) => setForm({ ...form, rollbackProcedure: e.target.value })}
                />
              </FormField>

              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Feature flags are not a substitute for Module 07's emergency pause and circuit-breaker
          controls. Disabling a trading-related flag stops new operations according to its
          scope — it does not cancel submitted orders or close positions.
        </CardContent>
      </Card>
    </div>
  );
}
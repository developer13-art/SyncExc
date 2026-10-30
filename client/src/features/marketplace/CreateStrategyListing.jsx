import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Workflow } from 'lucide-react';

import { automationApi, marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { useToast } from '../../hooks/useToast.js';

const STEPS = ['Listing type', 'Details', 'Review'];
const MARKET_OPTIONS = ['spot', 'futures', 'perpetual'];

export default function CreateStrategyListing() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [workflowId, setWorkflowId] = useState('');
  const [workflowVersionId, setWorkflowVersionId] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'Momentum',
    description: '',
    supportedMarkets: ['spot'],
    providerPlanId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const providerQuery = useQuery({
    queryKey: ['marketplace', 'my-provider'],
    queryFn: () => marketplaceApi.getMyProvider(),
    staleTime: 30_000,
  });
  const workflowsQuery = useQuery({
    queryKey: ['automation', 'workflows', { status: 'active', limit: 50 }],
    queryFn: () => automationApi.listWorkflows({ status: 'active', limit: 50 }),
    staleTime: 30_000,
  });
  const plansQuery = useQuery({
    queryKey: ['marketplace', 'my-plans'],
    queryFn: () => marketplaceApi.getMyProviderPlans(),
    enabled: Boolean(providerQuery.data),
    staleTime: 30_000,
  });
  const workflows = workflowsQuery.data?.items ?? [];
  const selectedWorkflow = workflows.find((workflow) => workflow.id === workflowId);
  const versionsQuery = useQuery({
    queryKey: ['automation', 'versions', workflowId],
    queryFn: () => automationApi.listVersions(workflowId),
    enabled: Boolean(workflowId),
    staleTime: 30_000,
  });
  const versions = Array.isArray(versionsQuery.data) ? versionsQuery.data : [];
  const publishedVersions = useMemo(
    () => versions.filter((version) => version.is_published === true),
    [versions],
  );
  const plans = (plansQuery.data ?? []).filter((plan) => plan.status === 'active');
  const provider = providerQuery.data;
  const profileReady =
    provider?.visibility === 'public' && provider?.moderationState === 'approved';

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Create strategy listing'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'My Marketplace', path: ROUTES.app.trader.marketplace },
      { label: 'Create listing', path: ROUTES.app.trader.createListing },
    ]));
  }, [dispatch]);

  useEffect(() => {
    if (!workflowId && workflows.length) setWorkflowId(workflows[0].id);
  }, [workflowId, workflows]);

  useEffect(() => {
    if (!publishedVersions.some((version) => version.id === workflowVersionId)) {
      setWorkflowVersionId(publishedVersions[0]?.id ?? '');
    }
  }, [publishedVersions, workflowVersionId]);

  const updateForm = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };
  const toggleMarket = (market) => {
    setForm((current) => ({
      ...current,
      supportedMarkets: current.supportedMarkets.includes(market)
        ? current.supportedMarkets.filter((item) => item !== market)
        : [...current.supportedMarkets, market],
    }));
  };

  const submit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const created = await marketplaceApi.createMyStrategy({
        workflowId,
        workflowVersionId,
        ...(form.providerPlanId ? { providerPlanId: form.providerPlanId } : {}),
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        supportedMarkets: form.supportedMarkets,
      });
      await queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      toast.success('Strategy listing created');
      navigate(ROUTES.app.marketplace.strategy(created.id));
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (providerQuery.isLoading || workflowsQuery.isLoading) {
    return <LoadingState label="Loading listing setup" />;
  }
  if (providerQuery.isError || workflowsQuery.isError) {
    return (
      <ErrorState
        title="Listing setup unavailable"
        description={getErrorMessage(providerQuery.error || workflowsQuery.error)}
        onRetry={() => {
          providerQuery.refetch();
          workflowsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link to={ROUTES.app.trader.marketplace}>
          <ArrowLeft className="h-4 w-4" /> Back to My Marketplace
        </Link>
      </Button>
      <header>
        <p className="text-sm font-medium text-primary">Trader workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Create a marketplace listing
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publish a validated, active automation workflow as a strategy.
        </p>
      </header>

      <ol className="grid grid-cols-3 gap-2" aria-label="Listing creation progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              index <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {index < step ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className={index === step ? 'text-xs font-medium text-foreground sm:text-sm' : 'text-xs text-muted-foreground sm:text-sm'}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {!profileReady ? (
        <Alert variant="warning">
          Publish and receive approval for your Trader profile before creating a public listing.
          <Link className="ml-1 font-medium underline" to={ROUTES.app.marketplace.traderProfile}>
            Review profile
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-5 p-5 pt-5 sm:p-6 sm:pt-6">
          {step === 0 ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold text-foreground">Choose listing type and workflow</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Strategy listings reuse an active workflow and its published version.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" className="rounded-xl bg-primary/10 p-4 text-left text-primary" aria-pressed="true">
                  <Workflow className="h-5 w-5" />
                  <span className="mt-3 block font-semibold">Strategy</span>
                  <span className="mt-1 block text-xs text-muted-foreground">List a published workflow</span>
                </button>
                <Link
                  to={ROUTES.app.trader.profile}
                  className="rounded-xl bg-muted/50 p-4 text-left transition hover:bg-muted"
                >
                  <span className="font-semibold text-foreground">Signal provider</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Manage your Trader profile and signal plans</span>
                </Link>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="listing-workflow">Active workflow</Label>
                <select
                  id="listing-workflow"
                  value={workflowId}
                  onChange={(event) => {
                    setWorkflowId(event.target.value);
                    setWorkflowVersionId('');
                  }}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  {workflows.length === 0 ? <option value="">No active workflows</option> : null}
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>{workflow.name} · v{workflow.currentVersion}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Workflows must include a strategy market-data node and at least one strategy order node.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="listing-workflow-version">Published version</Label>
                <select
                  id="listing-workflow-version"
                  value={workflowVersionId}
                  onChange={(event) => setWorkflowVersionId(event.target.value)}
                  disabled={versionsQuery.isLoading || publishedVersions.length === 0}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50"
                >
                  {versionsQuery.isLoading ? <option value="">Loading versions…</option> : null}
                  {!versionsQuery.isLoading && publishedVersions.length === 0 ? <option value="">No published version</option> : null}
                  {publishedVersions.map((version) => (
                    <option key={version.id} value={version.id}>Version {version.version}</option>
                  ))}
                </select>
                {versionsQuery.isError ? (
                  <p className="text-xs text-destructive">{getErrorMessage(versionsQuery.error)}</p>
                ) : null}
              </div>
            </div>
          ) : step === 1 ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold text-foreground">Listing details</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tell traders what the workflow does and where it can operate.</p>
              </div>
              <Field label="Strategy name" htmlFor="strategy-name">
                <Input id="strategy-name" value={form.name} onChange={updateForm('name')} maxLength={100} placeholder="Momentum Pro" />
              </Field>
              <Field label="Category" htmlFor="strategy-category">
                <Input id="strategy-category" value={form.category} onChange={updateForm('category')} maxLength={64} placeholder="Momentum" />
              </Field>
              <Field label="Description" htmlFor="strategy-description">
                <Textarea id="strategy-description" value={form.description} onChange={updateForm('description')} maxLength={4000} rows={5} placeholder="Describe the approach, conditions, and important risks…" />
              </Field>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">Supported markets</legend>
                <div className="flex flex-wrap gap-2">
                  {MARKET_OPTIONS.map((market) => (
                    <button
                      key={market}
                      type="button"
                      aria-pressed={form.supportedMarkets.includes(market)}
                      onClick={() => toggleMarket(market)}
                      className={`rounded-full px-3 py-2 text-xs font-medium capitalize ${
                        form.supportedMarkets.includes(market)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {market}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Field label="Subscription plan (optional)" htmlFor="strategy-plan">
                <select
                  id="strategy-plan"
                  value={form.providerPlanId}
                  onChange={updateForm('providerPlanId')}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="">No plan required</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </Field>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-foreground">Review before publishing</h2>
                <p className="mt-1 text-sm text-muted-foreground">Check the strategy information and source workflow.</p>
              </div>
              <Summary label="Listing type" value="Strategy" />
              <Summary label="Name" value={form.name || '—'} />
              <Summary label="Workflow" value={selectedWorkflow?.name || '—'} />
              <Summary label="Workflow version" value={publishedVersions.find((version) => version.id === workflowVersionId)?.version ?? '—'} />
              <Summary label="Category" value={form.category || '—'} />
              <Summary label="Markets" value={form.supportedMarkets.join(', ') || '—'} />
              <Summary label="Subscription plan" value={plans.find((plan) => plan.id === form.providerPlanId)?.name || 'No plan required'} />
              <p className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                The strategy uses the selected workflow version. Changes to the original workflow
                do not silently change this listing.
              </p>
              {submitError ? <p className="text-sm text-destructive" role="alert">{submitError}</p> : null}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || submitting}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => {
                  if (step === 0 && (!workflowId || !workflowVersionId)) return;
                  if (step === 1 && (!form.name.trim() || !form.category.trim() || !form.description.trim() || form.supportedMarkets.length === 0)) return;
                  setStep((current) => current + 1);
                }}
                disabled={
                  (step === 0 && (!workflowId || !workflowVersionId || versionsQuery.isLoading)) ||
                  (step === 1 && (!form.name.trim() || !form.category.trim() || !form.description.trim() || form.supportedMarkets.length === 0))
                }
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                onClick={submit}
                disabled={submitting || !profileReady || !workflowId || !workflowVersionId}
              >
                {submitting ? 'Publishing…' : 'Publish listing'}
              </Button>
            )}
          </div>
          {plansQuery.isError ? (
            <p className="text-sm text-destructive" role="alert">
              Subscription plans could not be loaded: {getErrorMessage(plansQuery.error)}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

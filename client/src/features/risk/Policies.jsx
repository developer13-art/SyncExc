import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Shield } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { PolicyCard } from './components/PolicyCard.jsx';
import { useRiskPolicies } from '../../hooks/useRisk.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'suspended', label: 'Suspended' },
];

export default function Policies() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [activateTarget, setActivateTarget] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Risk Policies'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Risk', path: ROUTES.app.risk.overview },
        { label: 'Policies', path: ROUTES.app.risk.policies },
      ]),
    );
  }, [dispatch]);

  const { policies, isLoading, isError, refetch, activatePolicy, suspendPolicy } =
    useRiskPolicies({ status: status === 'all' ? undefined : status, q: query || undefined });

  const handleActivate = async () => {
    if (!activateTarget) {
      return;
    }
    setProcessing(true);
    try {
      await activatePolicy({ policyId: activateTarget.id });
      toast.success('Policy activated');
      setActivateTarget(null);
    } catch (err) {
      toast.error('Activation failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) {
      return;
    }
    setProcessing(true);
    try {
      await suspendPolicy({ policyId: suspendTarget.id, reason: 'Manual suspension' });
      toast.success('Policy suspended');
      setSuspendTarget(null);
    } catch (err) {
      toast.error('Suspension failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Risk Policies
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure the rules that gate every consequential operation.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.app.risk.createPolicy}>
            <Plus className="h-4 w-4" /> New policy
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search policies…"
            className="w-full max-w-xs"
          />
          <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
        </div>
        <IconButton label="Refresh" onClick={refetch} className="border border-border">
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </div>

      {isLoading ? (
        <LoadingState label="Loading policies" />
      ) : isError ? (
        <ErrorState
          title="Unable to load policies"
          description="We could not fetch risk policies."
          onRetry={refetch}
        />
      ) : policies.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={query || status !== 'all' ? 'No matching policies' : 'No risk policies yet'}
          description={
            query || status !== 'all'
              ? 'Try adjusting your filters.'
              : 'Create a risk policy to enforce order limits, position limits, and exposure checks across your workspace.'
          }
          action={
            !query && status === 'all' ? (
              <Button asChild>
                <Link to={ROUTES.app.risk.createPolicy}>Create policy</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              onActivate={setActivateTarget}
              onSuspend={setSuspendTarget}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(activateTarget)}
        onOpenChange={(open) => !open && setActivateTarget(null)}
        title="Activate policy?"
        description="The policy will begin enforcing on all matching operations immediately."
        confirmLabel="Activate"
        onConfirm={handleActivate}
        isLoading={processing}
      />

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title="Suspend policy?"
        description="Suspending stops enforcement for this policy. Existing operations already evaluated are not affected."
        confirmLabel="Suspend"
        variant="warning"
        onConfirm={handleSuspend}
        isLoading={processing}
      />
    </div>
  );
}
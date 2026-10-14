import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { referralsApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

export default function PolicyEditor() {
  const { policyId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    firstPaymentRate: '',
    recurringRate: '',
    commissionDurationMonths: '',
    minimumQualifyingAmount: '',
    holdingPeriodDays: '',
    effectiveFrom: '',
  });
  const [error, setError] = useState(null);

  const isNew = !policyId || policyId === 'new';

  const policyQuery = useQuery({
    queryKey: ['referrals', 'policy', policyId],
    queryFn: () => referralsApi.getPolicy(policyId),
    enabled: !isNew,
  });

  useEffect(() => {
    if (isNew) {
      dispatch(adminUiActions.setPageTitle('New Referral Policy'));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Referrals', path: '/referrals' },
          { label: 'Policies', path: '/referrals/policies' },
          { label: 'New', path: '/referrals/policies/new' },
        ]),
      );
    } else if (policyQuery.data) {
      const policy = policyQuery.data;
      setForm({
        name: policy.name ?? '',
        description: policy.description ?? '',
        firstPaymentRate: policy.firstPaymentRate?.toString() ?? '',
        recurringRate: policy.recurringRate?.toString() ?? '',
        commissionDurationMonths: policy.commissionDurationMonths?.toString() ?? '',
        minimumQualifyingAmount: policy.minimumQualifyingAmount?.toString() ?? '',
        holdingPeriodDays: policy.holdingPeriodDays?.toString() ?? '',
        effectiveFrom: policy.effectiveFrom?.slice(0, 10) ?? '',
      });
      dispatch(adminUiActions.setPageTitle(`Edit · ${policy.name}`));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Referrals', path: '/referrals' },
          { label: 'Policies', path: '/referrals/policies' },
          { label: policy.name, path: `/referrals/policies/${policyId}` },
        ]),
      );
    }
  }, [isNew, policyQuery.data, dispatch, policyId]);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isNew
        ? referralsApi.createPolicy(payload)
        : referralsApi.updatePolicy(policyId, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['referrals', 'policies'] });
      toast.success(isNew ? 'Policy draft created' : 'Policy updated');
      if (isNew) {
        navigate(`/referrals/policies/${result.id}`, { replace: true });
      }
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const publishMutation = useMutation({
    mutationFn: () => referralsApi.publishPolicy(policyId, { confirm: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals', 'policies'] });
      queryClient.invalidateQueries({ queryKey: ['referrals', 'policy', policyId] });
      toast.success('Policy published');
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  if (!isNew && policyQuery.isLoading) {
    return <LoadingState label="Loading policy" />;
  }

  if (!isNew && (policyQuery.error || !policyQuery.data)) {
    return (
      <ErrorState
        title="Unable to load policy"
        description="This referral policy could not be retrieved."
        onRetry={policyQuery.refetch}
      />
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Policy name is required');
      return;
    }
    if (!form.firstPaymentRate) {
      setError('First-payment rate is required');
      return;
    }
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      firstPaymentRate: Number(form.firstPaymentRate),
      recurringRate: form.recurringRate ? Number(form.recurringRate) : undefined,
      commissionDurationMonths: form.commissionDurationMonths
        ? Number(form.commissionDurationMonths)
        : undefined,
      minimumQualifyingAmount: form.minimumQualifyingAmount
        ? Number(form.minimumQualifyingAmount)
        : undefined,
      holdingPeriodDays: form.holdingPeriodDays ? Number(form.holdingPeriodDays) : undefined,
      effectiveFrom: form.effectiveFrom || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/referrals/policies">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isNew ? 'New referral policy' : `Edit · ${form.name}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Commission rates apply per the policy version effective on the payment date.
            Historical commissions are never recalculated.
          </p>
        </div>
        {!isNew && policyQuery.data?.status === 'draft' ? (
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            <Send className="h-4 w-4" />
            {publishMutation.isPending ? 'Publishing…' : 'Publish policy'}
          </Button>
        ) : null}
      </div>

      <Alert variant="info" title="Commissions are based on subscription revenue only">
        <p className="text-xs">
          Rates must never reference trading volume, losses, or exchange balances. Referral
          rewards are computed against qualifying subscription payments.
        </p>
      </Alert>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <FormError>{error}</FormError>

          <Card>
            <CardHeader>
              <CardTitle>Policy basics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField label="Policy name" htmlFor="policy-name" required>
                <Input
                  id="policy-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormField>
              <FormField label="Description" htmlFor="policy-description">
                <Textarea
                  id="policy-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>
              <FormField label="Effective from" htmlFor="policy-effective">
                <Input
                  id="policy-effective"
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commission rates</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                label="First-payment rate (%)"
                htmlFor="policy-first-rate"
                required
              >
                <Input
                  id="policy-first-rate"
                  type="text"
                  inputMode="decimal"
                  value={form.firstPaymentRate}
                  onChange={(e) =>
                    setForm({ ...form, firstPaymentRate: e.target.value })
                  }
                  placeholder="20"
                />
              </FormField>
              <FormField label="Recurring rate (%)" htmlFor="policy-recurring-rate">
                <Input
                  id="policy-recurring-rate"
                  type="text"
                  inputMode="decimal"
                  value={form.recurringRate}
                  onChange={(e) => setForm({ ...form, recurringRate: e.target.value })}
                  placeholder="10"
                />
              </FormField>
              <FormField
                label="Commission duration (months)"
                htmlFor="policy-duration"
              >
                <Input
                  id="policy-duration"
                  type="text"
                  inputMode="numeric"
                  value={form.commissionDurationMonths}
                  onChange={(e) =>
                    setForm({ ...form, commissionDurationMonths: e.target.value })
                  }
                  placeholder="12"
                />
              </FormField>
              <FormField
                label="Minimum qualifying amount"
                htmlFor="policy-min-amount"
              >
                <Input
                  id="policy-min-amount"
                  type="text"
                  inputMode="decimal"
                  value={form.minimumQualifyingAmount}
                  onChange={(e) =>
                    setForm({ ...form, minimumQualifyingAmount: e.target.value })
                  }
                  placeholder="10.00"
                />
              </FormField>
              <FormField
                label="Holding period (days)"
                htmlFor="policy-holding"
              >
                <Input
                  id="policy-holding"
                  type="text"
                  inputMode="numeric"
                  value={form.holdingPeriodDays}
                  onChange={(e) =>
                    setForm({ ...form, holdingPeriodDays: e.target.value })
                  }
                  placeholder="30"
                />
              </FormField>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/referrals/policies">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending
                ? 'Saving…'
                : isNew
                  ? 'Create policy draft'
                  : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
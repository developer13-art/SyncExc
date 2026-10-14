import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { useRiskPolicy } from '../../hooks/useRisk.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const ENFORCEMENT_MODES = [
  { value: 'block', label: 'Block' },
  { value: 'require_confirmation', label: 'Require confirmation' },
  { value: 'require_approval', label: 'Require approval' },
  { value: 'warn', label: 'Warn only' },
];

export default function PolicyEditor() {
  const { policyId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const policyQuery = useRiskPolicy(policyId);

  const [form, setForm] = useState({
    name: '',
    description: '',
    enforcementMode: 'block',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (policyQuery.policy) {
      setForm({
        name: policyQuery.policy.name ?? '',
        description: policyQuery.policy.description ?? '',
        enforcementMode: policyQuery.policy.enforcementMode ?? 'block',
      });
      dispatch(uiActions.setPageTitle(`Edit: ${policyQuery.policy.name}`));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Risk', path: ROUTES.app.risk.overview },
          { label: 'Policies', path: ROUTES.app.risk.policies },
          {
            label: policyQuery.policy.name,
            path: ROUTES.app.risk.policy(policyId),
          },
          { label: 'Edit', path: ROUTES.app.risk.policyVersions(policyId) },
        ]),
      );
    }
  }, [policyQuery.policy, dispatch, policyId]);

  if (policyQuery.isLoading) {
    return <LoadingState label="Loading policy" />;
  }

  if (policyQuery.error || !policyQuery.policy) {
    return (
      <ErrorState
        title="Unable to load policy"
        description="This risk policy could not be retrieved."
        onRetry={policyQuery.refetch}
      />
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await policyQuery.updatePolicy(form);
      toast.success('Policy updated', {
        description: 'A new version was created.',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.risk.policy(policyId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Edit policy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saving creates a new version. Previous versions remain available for audit.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <FormError>{error}</FormError>

        <Card>
          <CardHeader>
            <CardTitle>Policy details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Name" htmlFor="edit-policy-name" required>
              <Input
                id="edit-policy-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>

            <FormField label="Description" htmlFor="edit-policy-description">
              <Textarea
                id="edit-policy-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>

            <FormField label="Enforcement mode" htmlFor="edit-policy-mode" required>
              <Select
                value={form.enforcementMode}
                onValueChange={(v) => setForm({ ...form, enforcementMode: v })}
              >
                <SelectTrigger id="edit-policy-mode" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENFORCEMENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rule configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-border">
              {(policyQuery.policy.rules ?? []).map((rule) => (
                <div
                  key={rule.key}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-sm text-foreground">{rule.label ?? rule.key}</span>
                  <span className="text-sm font-medium text-foreground">{rule.value}</span>
                </div>
              ))}
              {(policyQuery.policy.rules ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Rule editing is available on the create page. Contact support to modify
                  existing rule values.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.risk.policy(policyId)}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
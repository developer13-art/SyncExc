import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { useRiskPolicies } from '../../hooks/useRisk.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const ENFORCEMENT_MODES = [
  { value: 'block', label: 'Block — reject operations that violate' },
  { value: 'require_confirmation', label: 'Require confirmation' },
  { value: 'require_approval', label: 'Require additional approval' },
  { value: 'warn', label: 'Warn only (advisory)' },
];

const SCOPE_LEVELS = [
  { value: 'workspace', label: 'Entire workspace' },
  { value: 'group', label: 'Specific sync group' },
  { value: 'account', label: 'Specific account' },
  { value: 'instrument', label: 'Specific instrument' },
];

const RULE_TEMPLATES = [
  { key: 'max_order_notional', label: 'Maximum order notional', unit: 'USD' },
  { key: 'max_order_quantity', label: 'Maximum order quantity', unit: 'base' },
  { key: 'max_open_orders', label: 'Maximum open orders', unit: 'count' },
  { key: 'max_position_notional', label: 'Maximum position notional', unit: 'USD' },
  { key: 'max_leverage', label: 'Maximum leverage', unit: 'x' },
  { key: 'max_gross_exposure', label: 'Maximum gross exposure', unit: 'USD' },
  { key: 'data_freshness_seconds', label: 'Data freshness threshold', unit: 'seconds' },
];

export default function CreatePolicy() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createPolicy } = useRiskPolicies();

  const [form, setForm] = useState({
    name: '',
    description: '',
    enforcementMode: 'block',
    scopeLevel: 'workspace',
    rules: RULE_TEMPLATES.map((r) => ({ key: r.key, enabled: false, value: '' })),
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('New Risk Policy'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Risk', path: ROUTES.app.risk.overview },
        { label: 'Policies', path: ROUTES.app.risk.policies },
        { label: 'New', path: ROUTES.app.risk.createPolicy },
      ]),
    );
  }, [dispatch]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateRule = (ruleKey, updates) => {
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.key === ruleKey ? { ...r, ...updates } : r)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Policy name is required');
      return;
    }

    const enabledRules = form.rules.filter((r) => r.enabled);
    if (enabledRules.length === 0) {
      setError('Enable at least one rule');
      return;
    }

    for (const rule of enabledRules) {
      if (!rule.value || Number(rule.value) <= 0) {
        setError(`Please provide a valid value for "${rule.key}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const created = await createPolicy({
        name: form.name.trim(),
        description: form.description.trim(),
        enforcementMode: form.enforcementMode,
        scopeLevel: form.scopeLevel,
        rules: enabledRules.map((r) => ({
          key: r.key,
          value: Number(r.value),
        })),
      });

      toast.success('Policy created', {
        description: 'The policy is in draft. Activate it when ready.',
      });
      navigate(ROUTES.app.risk.policy(created.id), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.risk.policies}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create risk policy
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rules apply to every consequential operation within the configured scope. Higher-level
          restrictions cannot be weakened by lower-level policies.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FormError>{error}</FormError>

        <Card>
          <CardHeader>
            <CardTitle>Policy basics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Name" htmlFor="policy-name" required>
              <Input
                id="policy-name"
                autoFocus
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Default spot order limits"
              />
            </FormField>

            <FormField label="Description" htmlFor="policy-description">
              <Textarea
                id="policy-description"
                rows={2}
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Explain the purpose and scope of this policy."
              />
            </FormField>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Enforcement mode" htmlFor="policy-mode" required>
                <Select
                  value={form.enforcementMode}
                  onValueChange={(v) => updateField('enforcementMode', v)}
                >
                  <SelectTrigger id="policy-mode" className="mt-1.5">
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

              <FormField label="Scope" htmlFor="policy-scope" required>
                <Select
                  value={form.scopeLevel}
                  onValueChange={(v) => updateField('scopeLevel', v)}
                >
                  <SelectTrigger id="policy-scope" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_LEVELS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {RULE_TEMPLATES.map((template) => {
              const rule = form.rules.find((r) => r.key === template.key);
              return (
                <div
                  key={template.key}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between"
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={rule?.enabled ?? false}
                      onChange={(e) => updateRule(template.key, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    <span className="text-sm text-foreground">{template.label}</span>
                  </label>

                  <div className="flex items-center gap-2 md:w-64">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={rule?.value ?? ''}
                      onChange={(e) => updateRule(template.key, { value: e.target.value })}
                      disabled={!rule?.enabled}
                      placeholder="0.00"
                      className="flex-1"
                    />
                    <span className="w-16 text-xs text-muted-foreground">{template.unit}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.risk.policies}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create policy'}
          </Button>
        </div>
      </form>
    </div>
  );
}
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
import { TagInput } from '../../components/forms/TagInput.jsx';
import { CurrencyInput } from '../../components/forms/CurrencyInput.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { plansApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

export default function CreatePlan() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    price: '',
    currency: 'USD',
    billingInterval: 'month',
    features: [],
    limits: {},
    trialDays: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Create Plan'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Plans', path: '/plans' },
        { label: 'Create', path: '/plans/new' },
      ]),
    );
  }, [dispatch]);

  const updateField = (key) => (value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Plan name is required');
      return;
    }
    if (!form.code.trim()) {
      setError('Plan code is required');
      return;
    }
    if (!form.price || Number(form.price) < 0) {
      setError('A valid price is required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await plansApi.create({
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        description: form.description.trim() || undefined,
        price: form.price,
        currency: form.currency,
        billingInterval: form.billingInterval,
        features: form.features,
        limits: form.limits,
        trialDays: form.trialDays ? Number(form.trialDays) : undefined,
      });
      toast.success('Plan draft created');
      navigate(`/plans/${created.id}`, { replace: true });
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
          <Link to="/plans">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create a subscription plan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            New plans start as drafts. Publishing requires validation and appropriate approval.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormError>{error}</FormError>

              <FormField label="Plan name" htmlFor="plan-name" required>
                <Input
                  id="plan-name"
                  value={form.name}
                  onChange={(e) => updateField('name')(e.target.value)}
                  placeholder="Pro"
                />
              </FormField>

              <FormField
                label="Plan code"
                htmlFor="plan-code"
                required
                hint="Stable, unique identifier used in API responses and entitlements."
              >
                <Input
                  id="plan-code"
                  value={form.code}
                  onChange={(e) => updateField('code')(e.target.value)}
                  placeholder="pro"
                />
              </FormField>

              <FormField label="Description" htmlFor="plan-description">
                <Textarea
                  id="plan-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateField('description')(e.target.value)}
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Price" htmlFor="plan-price" required>
                  <CurrencyInput
                    id="plan-price"
                    currency={form.currency}
                    value={form.price}
                    onChange={updateField('price')}
                  />
                </FormField>
                <FormField label="Currency" htmlFor="plan-currency" required>
                  <Input
                    id="plan-currency"
                    value={form.currency}
                    onChange={(e) => updateField('currency')(e.target.value.toUpperCase())}
                  />
                </FormField>
              </div>

              <FormField label="Trial days" htmlFor="plan-trial" hint="Optional">
                <Input
                  id="plan-trial"
                  type="text"
                  inputMode="numeric"
                  value={form.trialDays}
                  onChange={(e) => updateField('trialDays')(e.target.value)}
                />
              </FormField>

              <FormField
                label="Features"
                htmlFor="plan-features"
                hint="Free-form labels shown to subscribers."
              >
                <TagInput
                  value={form.features}
                  onChange={updateField('features')}
                  placeholder="Add feature"
                />
              </FormField>

              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to="/plans">Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create plan draft'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
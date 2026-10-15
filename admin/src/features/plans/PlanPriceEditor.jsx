import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { plansApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';

export function PlanPriceEditor({ planId, prices = [], features = {}, limits = {} }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    currency: 'USD',
    amount: '',
    billingInterval: 'month',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    const interval = form.billingInterval.trim().toLowerCase();
    if (!['month', 'monthly', 'year', 'yearly'].includes(interval)) {
      toast.error('Billing interval must be monthly or yearly');
      return;
    }
    setSubmitting(true);
    try {
      await plansApi.createVersion(planId, {
        features: Array.isArray(features)
          ? Object.fromEntries(features.map((feature) => [feature, true]))
          : features,
        limits,
        prices: [
          ...prices.map((price) => ({
            currency: price.currency,
            amountMinor: Number(price.amountMinor),
            billingInterval:
              price.billingInterval === 'monthly' ? 'monthly' : 'yearly',
          })),
          {
            currency: form.currency,
            amountMinor: Math.round(Number(form.amount) * 100),
            billingInterval: interval.startsWith('month') ? 'monthly' : 'yearly',
          },
        ],
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      toast.success('Price entry added');
      setOpen(false);
      setForm({
        currency: 'USD',
        amount: '',
        billingInterval: 'month',
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      toast.error('Failed to add price', { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Prices</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Adding a new price creates a new version. Existing subscribers retain the price
              and version they agreed to at checkout.
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add price
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {prices.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No prices configured yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {prices.map((price, i) => (
              <li
                key={`${price.currency}-${i}`}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatCurrency(price.amount, price.currency)}
                    <span className="text-muted-foreground">
                      {' '}
                      / {price.billingInterval ?? 'month'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {price.currency}
                    {price.effectiveFrom
                      ? ` · Effective ${formatDate(price.effectiveFrom)}`
                      : ''}
                    {price.providerPriceReference
                      ? ` · ${price.providerPriceReference}`
                      : ''}
                  </p>
                </div>
                <Badge variant={price.active !== false ? 'success' : 'muted'}>
                  {price.active !== false ? 'active' : 'inactive'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Add price entry"
        description="Prices are versioned. Existing subscribers keep their agreed price."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Adding…' : 'Add price'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Currency" htmlFor="price-currency" required>
            <Input
              id="price-currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
            />
          </FormField>
          <FormField label="Amount" htmlFor="price-amount" required>
            <Input
              id="price-amount"
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="29.00"
            />
          </FormField>
          <FormField label="Billing interval" htmlFor="price-interval" required>
            <Input
              id="price-interval"
              value={form.billingInterval}
              onChange={(e) => setForm({ ...form, billingInterval: e.target.value })}
            />
          </FormField>
          <FormField label="Effective from" htmlFor="price-effective" required>
            <Input
              id="price-effective"
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            />
          </FormField>
        </div>
      </Modal>
    </Card>
  );
}
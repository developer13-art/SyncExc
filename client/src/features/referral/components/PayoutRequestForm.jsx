import { Controller, useForm } from 'react-hook-form';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select.jsx';
import { InfoCallout } from '../../../components/ui/InfoCallout.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';

export function PayoutRequestForm({
  methods = [],
  payableBalance = 0,
  currency = 'USD',
  minimumPayout,
  onSubmit,
  onCancel,
  isSubmitting,
  formError,
  className,
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      methodId: methods[0]?.id ?? '',
      amount: '',
      notes: '',
    },
  });

  const amount = watch('amount');
  const numericAmount = Number(amount) || 0;
  const exceedsBalance = numericAmount > payableBalance;
  const belowMinimum = minimumPayout !== undefined && numericAmount < minimumPayout;

  const submit = handleSubmit((values) => {
    if (exceedsBalance || belowMinimum) {
      return;
    }
    onSubmit?.(values);
  });

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Available payable balance</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(payableBalance, currency)}
            </span>
          </div>
          {minimumPayout !== undefined ? (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Minimum payout</span>
              <span className="text-foreground">
                {formatCurrency(minimumPayout, currency)}
              </span>
            </div>
          ) : null}
        </div>

        {methods.length === 0 ? (
          <InfoCallout>
            Add a payout method before requesting a payout. Navigate to the payout methods page
            from your referral dashboard.
          </InfoCallout>
        ) : (
          <FormField label="Payout method" htmlFor="payout-method" required>
            <Controller
              control={control}
              name="methodId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="payout-method" className="mt-1.5">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label ?? m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        )}

        <FormField
          label="Amount"
          htmlFor="payout-amount"
          required
          error={
            errors.amount?.message ??
            (exceedsBalance
              ? 'Amount exceeds payable balance'
              : belowMinimum
                ? `Amount must be at least ${formatCurrency(minimumPayout, currency)}`
                : undefined)
          }
        >
          <Input
            id="payout-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            {...register('amount', {
              required: 'Amount is required',
              validate: (v) => Number(v) > 0 || 'Amount must be greater than zero',
            })}
          />
        </FormField>

        <FormField label="Notes" htmlFor="payout-notes">
          <Input id="payout-notes" {...register('notes')} placeholder="Optional" />
        </FormField>

        <InfoCallout>
          Payout requests are reviewed under the applicable policy. A request is not considered
          paid until the provider confirms completion. Ambiguous outcomes are reconciled before
          retrying.
        </InfoCallout>

        {formError ? (
          <p className="text-xs text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={isSubmitting || methods.length === 0 || exceedsBalance || belowMinimum}
          >
            {isSubmitting ? 'Requesting…' : 'Request payout'}
          </Button>
        </div>
      </div>
    </form>
  );
}
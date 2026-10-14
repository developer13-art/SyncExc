import { Controller, useForm } from 'react-hook-form';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Label } from '../../../components/ui/Label.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select.jsx';
import { InfoCallout } from '../../../components/ui/InfoCallout.jsx';

const POLICY_TYPES = [
  { value: 'fixed_quantity', label: 'Fixed quantity' },
  { value: 'fixed_quote', label: 'Fixed quote value' },
  { value: 'proportional', label: 'Proportional to source' },
  { value: 'balance_scaled', label: 'Balance-based scaling' },
  { value: 'risk_limited', label: 'Risk-limited sizing' },
  { value: 'capped_proportional', label: 'Capped proportional' },
];

export function SizingForm({
  value,
  onSubmit,
  onCancel,
  isSubmitting,
  className,
  submitLabel = 'Save sizing policy',
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: value?.type ?? 'proportional',
      scaleFactor: value?.scaleFactor ?? 1,
      fixedAmount: value?.fixedAmount ?? '',
      minQuantity: value?.minQuantity ?? '',
      maxQuantity: value?.maxQuantity ?? '',
      maxNotional: value?.maxNotional ?? '',
      baseDenomination: value?.baseDenomination ?? 'source_quantity',
      roundingPolicy: value?.roundingPolicy ?? 'down',
    },
  });

  const type = watch('type');

  const requiresScaleFactor = ['proportional', 'capped_proportional', 'balance_scaled'].includes(
    type,
  );
  const requiresFixedAmount = ['fixed_quantity', 'fixed_quote'].includes(type);

  const submit = handleSubmit((values) => {
    onSubmit?.(values);
  });

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <FormField label="Sizing policy type" htmlFor="sizing-type" required>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {requiresScaleFactor ? (
          <FormField
            label="Scale factor"
            htmlFor="sizing-scale"
            hint="Multiply the source quantity by this factor for each destination."
            error={errors.scaleFactor?.message}
          >
            <Input
              id="sizing-scale"
              type="text"
              inputMode="decimal"
              placeholder="1.0"
              {...register('scaleFactor', {
                required: 'Scale factor is required',
                validate: (v) => Number(v) > 0 || 'Must be greater than zero',
              })}
              error={errors.scaleFactor?.message}
            />
          </FormField>
        ) : null}

        {requiresFixedAmount ? (
          <FormField
            label={
              type === 'fixed_quantity'
                ? 'Fixed quantity'
                : 'Fixed quote value'
            }
            htmlFor="sizing-fixed"
            error={errors.fixedAmount?.message}
          >
            <Input
              id="sizing-fixed"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              {...register('fixedAmount', {
                required: 'Value is required',
                validate: (v) => Number(v) > 0 || 'Must be greater than zero',
              })}
              error={errors.fixedAmount?.message}
            />
          </FormField>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Minimum quantity"
            htmlFor="sizing-min"
            hint="Optional floor"
            error={errors.minQuantity?.message}
          >
            <Input
              id="sizing-min"
              type="text"
              inputMode="decimal"
              placeholder="0"
              {...register('minQuantity')}
              error={errors.minQuantity?.message}
            />
          </FormField>

          <FormField
            label="Maximum quantity"
            htmlFor="sizing-max"
            hint="Optional ceiling"
            error={errors.maxQuantity?.message}
          >
            <Input
              id="sizing-max"
              type="text"
              inputMode="decimal"
              placeholder="—"
              {...register('maxQuantity')}
              error={errors.maxQuantity?.message}
            />
          </FormField>
        </div>

        <FormField
          label="Maximum notional"
          htmlFor="sizing-notional"
          hint="Cap the total value per destination"
          error={errors.maxNotional?.message}
        >
          <Input
            id="sizing-notional"
            type="text"
            inputMode="decimal"
            placeholder="—"
            {...register('maxNotional')}
            error={errors.maxNotional?.message}
          />
        </FormField>

        <FormField label="Rounding policy" htmlFor="sizing-rounding">
          <Controller
            control={control}
            name="roundingPolicy"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="down">Round down</SelectItem>
                  <SelectItem value="up">Round up</SelectItem>
                  <SelectItem value="nearest">Round nearest</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <InfoCallout>
          If the computed quantity falls below the destination's minimum, or required market
          data is stale, the operation is held and a clear reason is recorded.
        </InfoCallout>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
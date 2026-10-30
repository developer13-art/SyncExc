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
import { DestinationSelector } from '../../synchronization/components/DestinationSelector.jsx';

const SIZING_OPTIONS = [
  { value: 'fixed_amount', label: 'Fixed amount' },
  { value: 'fixed_percentage', label: 'Fixed percentage of balance' },
];

const EXECUTION_MODES = [
  { value: 'monitor_only', label: 'Monitor only' },
  { value: 'confirm_before_execution', label: 'Confirm before execution' },
  { value: 'authorized_automation', label: 'Authorized automation' },
];

export function CopyConfigForm({
  provider,
  providerPlans = [],
  accounts = [],
  value,
  onSubmit,
  onCancel,
  isSubmitting,
  formError,
  submitLabel = 'Create copy configuration',
  className,
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: value?.name ?? `Copy from ${provider?.displayName ?? 'provider'}`,
      planId: value?.planId ?? providerPlans[0]?.id ?? '',
      destinationAccountIds: value?.destinationAccountIds ?? [],
      sizingType: value?.sizingType ?? 'fixed_amount',
      sizingValue: value?.sizingValue ?? '',
      stopLossPercent: value?.stopLossPercent ?? '',
      takeProfitPercent: value?.takeProfitPercent ?? '',
      executionMode: value?.executionMode ?? 'confirm_before_execution',
      maxOpenPositions: value?.maxOpenPositions ?? 5,
      notes: value?.notes ?? '',
    },
  });

  const sizingType = watch('sizingType');
  const destinationAccountIds = watch('destinationAccountIds');

  const submit = handleSubmit((values) => onSubmit?.(values));

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <FormField
          label="Configuration name"
          htmlFor="copy-name"
          required
          error={errors.name?.message}
        >
          <Input
            id="copy-name"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
          />
        </FormField>

        {providerPlans.length > 0 ? (
          <FormField
            label="Provider plan"
            htmlFor="copy-plan"
            required
            error={errors.planId?.message}
          >
            <Controller
              control={control}
              name="planId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="copy-plan" className="mt-1.5">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        ) : null}

        <FormField
          label="Destination accounts"
          required
          error={errors.destinationAccountIds?.message}
        >
          <DestinationSelector
            accounts={accounts}
            value={destinationAccountIds}
            onChange={(ids) => setValue('destinationAccountIds', ids, { shouldValidate: true })}
          />
          {errors.destinationAccountIds ? (
            <p className="text-xs text-destructive">{errors.destinationAccountIds.message}</p>
          ) : null}
        </FormField>

        <FormField label="Sizing method" htmlFor="copy-sizing" required>
          <Controller
            control={control}
            name="sizingType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="copy-sizing" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          label={
            sizingType === 'fixed_percentage'
              ? 'Percentage (%)'
              : 'Fixed amount'
          }
          htmlFor="copy-sizing-value"
          required
          error={errors.sizingValue?.message}
        >
          <Input
            id="copy-sizing-value"
            type="text"
            inputMode="decimal"
            placeholder={sizingType === 'fixed_percentage' ? '5' : '100'}
            {...register('sizingValue', {
              required: 'Sizing value is required',
              validate: (v) => Number(v) > 0 || 'Must be greater than zero',
            })}
            error={errors.sizingValue?.message}
          />
        </FormField>

        <div className="grid gap-4 rounded-lg border border-border p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Protection overrides</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Set optional distances from the execution/reference price. Leave a field blank to
              use the provider signal&apos;s protection for that leg.
            </p>
          </div>
          <FormField
            label="Stop-loss distance (%)"
            htmlFor="copy-stop-loss-percent"
            hint="For example, 2 means 2% from the execution/reference price."
          >
            <Input
              id="copy-stop-loss-percent"
              type="number"
              min="0.0001"
              max="99.9999"
              step="0.0001"
              inputMode="decimal"
              placeholder="Use provider value"
              {...register('stopLossPercent', {
                validate: (value) =>
                  value === '' ||
                  (/^\d+(?:\.\d{1,4})?$/.test(value) &&
                    Number(value) > 0 &&
                    Number(value) < 100) ||
                  'Enter a percentage greater than 0 and less than 100 (up to 4 decimals)',
              })}
              error={errors.stopLossPercent?.message}
            />
          </FormField>
          <FormField
            label="Take-profit distance (%)"
            htmlFor="copy-take-profit-percent"
            hint="For example, 4 means 4% from the execution/reference price."
          >
            <Input
              id="copy-take-profit-percent"
              type="number"
              min="0.0001"
              max="99.9999"
              step="0.0001"
              inputMode="decimal"
              placeholder="Use provider value"
              {...register('takeProfitPercent', {
                validate: (value) =>
                  value === '' ||
                  (/^\d+(?:\.\d{1,4})?$/.test(value) &&
                    Number(value) > 0 &&
                    Number(value) < 100) ||
                  'Enter a percentage greater than 0 and less than 100 (up to 4 decimals)',
              })}
              error={errors.takeProfitPercent?.message}
            />
          </FormField>
        </div>

        <FormField label="Execution mode" htmlFor="copy-mode" required>
          <Controller
            control={control}
            name="executionMode"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="copy-mode" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXECUTION_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          label="Maximum open positions"
          htmlFor="copy-max-open"
          hint="Cap the number of concurrent copied positions."
          error={errors.maxOpenPositions?.message}
        >
          <Input
            id="copy-max-open"
            type="text"
            inputMode="numeric"
            {...register('maxOpenPositions', {
              validate: (v) => Number(v) > 0 || 'Must be greater than zero',
            })}
            error={errors.maxOpenPositions?.message}
          />
        </FormField>

        <FormField label="Notes" htmlFor="copy-notes">
          <Input id="copy-notes" {...register('notes')} placeholder="Optional" />
        </FormField>

        <InfoCallout>
          Subscribing to a provider grants content access. Enabling copying requires this
          separate configuration and remains subject to authorization, capability, and risk
          checks on every proposed destination operation.
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
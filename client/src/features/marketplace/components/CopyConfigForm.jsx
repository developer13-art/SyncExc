import { useState } from 'react';
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
    trigger,
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
  const formValues = watch();
  const [step, setStep] = useState(0);
  const steps = ['Exchange', 'Allocation', 'Risk & settings', 'Review'];
  const stepFields = [
    ['name', 'planId', 'destinationAccountIds'],
    ['sizingType', 'sizingValue'],
    ['stopLossPercent', 'takeProfitPercent', 'executionMode', 'maxOpenPositions'],
    [],
  ];
  const submit = handleSubmit((values) => onSubmit?.(values));
  const nextStep = async () => {
    if (await trigger(stepFields[step])) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  return (
    <form onSubmit={(event) => event.preventDefault()} className={className}>
      <div className="flex flex-col gap-5">
        <ol className="grid grid-cols-4 gap-2" aria-label="Copy setup progress">
          {steps.map((label, index) => (
            <li key={label} className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  index <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {index < step ? '✓' : index + 1}
                </span>
                <span className={`truncate text-[10px] sm:text-xs ${
                  index === step ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}>{label}</span>
              </div>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-foreground">Select exchange accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose the destinations that can receive copied trades.</p>
            </div>
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
              <FormField label="Provider plan" htmlFor="copy-plan" required error={errors.planId?.message}>
                <Controller
                  control={control}
                  name="planId"
                  rules={{ required: 'Select a provider plan' }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="copy-plan" className="mt-1.5">
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerPlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            ) : null}
            <FormField label="Destination exchange accounts" required error={errors.destinationAccountIds?.message}>
              <input
                type="hidden"
                {...register('destinationAccountIds', {
                  validate: (ids) => (ids?.length ?? 0) > 0 || 'Select at least one destination account',
                })}
              />
              <DestinationSelector
                accounts={accounts}
                value={destinationAccountIds}
                onChange={(ids) => setValue('destinationAccountIds', ids, { shouldValidate: true })}
              />
            </FormField>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-foreground">Set allocation</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose how much to allocate to each selected destination.</p>
            </div>
            <FormField label="Allocation method" htmlFor="copy-sizing" required>
              <Controller
                control={control}
                name="sizingType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="copy-sizing" className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIZING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              label={sizingType === 'fixed_percentage' ? 'Allocation percentage (%)' : 'Allocation amount'}
              htmlFor="copy-sizing-value"
              required
              error={errors.sizingValue?.message}
            >
              <Input
                id="copy-sizing-value"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder={sizingType === 'fixed_percentage' ? '5' : '100'}
                {...register('sizingValue', {
                  required: 'Sizing value is required',
                  validate: (value) => Number(value) > 0 || 'Must be greater than zero',
                })}
                error={errors.sizingValue?.message}
              />
            </FormField>
            <InfoCallout>
              Fixed amounts apply per selected destination. Exchange balance and market checks are repeated before an order is sent.
            </InfoCallout>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-foreground">Risk and settings</h2>
              <p className="mt-1 text-sm text-muted-foreground">Define protection and execution controls for copied trades.</p>
            </div>
            <div className="grid gap-4 rounded-lg bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">Protection overrides</p>
              <p className="-mt-3 text-xs text-muted-foreground">
                Leave a field blank to use that protection level from the provider signal.
              </p>
              <FormField label="Stop-loss distance (%)" htmlFor="copy-stop-loss-percent">
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
                      (/^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0 && Number(value) < 100) ||
                      'Enter a percentage greater than 0 and less than 100 (up to 4 decimals)',
                  })}
                  error={errors.stopLossPercent?.message}
                />
              </FormField>
              <FormField label="Take-profit distance (%)" htmlFor="copy-take-profit-percent">
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
                      (/^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0 && Number(value) < 100) ||
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
                    <SelectTrigger id="copy-mode" className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXECUTION_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
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
                type="number"
                min="1"
                step="1"
                {...register('maxOpenPositions', {
                  validate: (value) => Number(value) > 0 || 'Must be greater than zero',
                })}
                error={errors.maxOpenPositions?.message}
              />
            </FormField>
            <FormField label="Notes" htmlFor="copy-notes">
              <Input id="copy-notes" {...register('notes')} placeholder="Optional" />
            </FormField>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-foreground">Review copy setup</h2>
              <p className="mt-1 text-sm text-muted-foreground">Confirm these settings before creating the configuration.</p>
            </div>
            <ReviewRow label="Name" value={formValues.name || '—'} />
            <ReviewRow label="Plan" value={providerPlans.find((plan) => plan.id === formValues.planId)?.name || 'Free access'} />
            <ReviewRow label="Destination accounts" value={`${destinationAccountIds?.length ?? 0} selected`} />
            <ReviewRow label="Allocation" value={`${formValues.sizingValue || '—'} ${sizingType === 'fixed_percentage' ? '%' : 'per account'}`} />
            <ReviewRow label="Stop loss" value={formValues.stopLossPercent ? `${formValues.stopLossPercent}% from reference price` : 'Provider signal'} />
            <ReviewRow label="Take profit" value={formValues.takeProfitPercent ? `${formValues.takeProfitPercent}% from reference price` : 'Provider signal'} />
            <ReviewRow label="Execution" value={EXECUTION_MODES.find((mode) => mode.value === formValues.executionMode)?.label || '—'} />
            <InfoCallout>
              Every proposed destination operation remains subject to authorization, exchange capability, account balance, and risk checks.
            </InfoCallout>
          </div>
        ) : null}

        {formError ? <p className="text-xs text-destructive" role="alert">{formError}</p> : null}

        <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
          <div className="flex gap-2">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
            ) : null}
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep((current) => current - 1)} disabled={isSubmitting}>
                Back
              </Button>
            ) : null}
          </div>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={nextStep} disabled={isSubmitting}>Next</Button>
          ) : (
            <Button type="button" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : submitLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
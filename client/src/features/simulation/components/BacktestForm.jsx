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

const FILL_MODELS = [
  { value: 'immediate', label: 'Immediate simplified fill' },
  { value: 'trade_based', label: 'Trade-based fill' },
  { value: 'order_book_based', label: 'Order-book-based fill' },
  { value: 'partial_fill', label: 'Partial-fill model' },
  { value: 'latency_aware', label: 'Latency-aware model' },
  { value: 'failure_injection', label: 'Failure-injection model' },
];

export function BacktestForm({ environment, datasets = [], onSubmit, onCancel, isSubmitting, className }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      datasetId: datasets[0]?.id ?? '',
      startDate: '',
      endDate: '',
      fillModel: 'trade_based',
      feeModel: 'standard',
      slippageBps: 5,
      startingCapital: environment?.virtualBalance ?? 10000,
      seed: '',
    },
  });

  const submit = handleSubmit((values) => onSubmit?.(values));

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <FormField label="Dataset" htmlFor="backtest-dataset" required>
          <Controller
            control={control}
            name="datasetId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="backtest-dataset" className="mt-1.5">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Start date" htmlFor="backtest-start" required>
            <Input
              id="backtest-start"
              type="date"
              {...register('startDate', { required: 'Start date is required' })}
              error={errors.startDate?.message}
            />
          </FormField>
          <FormField label="End date" htmlFor="backtest-end" required>
            <Input
              id="backtest-end"
              type="date"
              {...register('endDate', { required: 'End date is required' })}
              error={errors.endDate?.message}
            />
          </FormField>
        </div>

        <FormField label="Fill model" htmlFor="backtest-fill" required>
          <Controller
            control={control}
            name="fillModel"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="backtest-fill" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILL_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Slippage (bps)" htmlFor="backtest-slippage">
            <Input
              id="backtest-slippage"
              type="text"
              inputMode="decimal"
              {...register('slippageBps')}
            />
          </FormField>
          <FormField label="Starting capital" htmlFor="backtest-capital">
            <Input
              id="backtest-capital"
              type="text"
              inputMode="decimal"
              {...register('startingCapital')}
            />
          </FormField>
        </div>

        <FormField
          label="Random seed"
          htmlFor="backtest-seed"
          hint="Optional. Provide a seed for reproducible runs."
        >
          <Input id="backtest-seed" {...register('seed')} placeholder="Optional" />
        </FormField>

        <InfoCallout>
          Simulation runs in an isolated context. It does not submit live orders, does not modify
          real exchange positions, and does not share records with live account ledgers. Every
          metric is labelled with its calculation method and known limitations.
        </InfoCallout>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Starting…' : 'Start backtest'}
          </Button>
        </div>
      </div>
    </form>
  );
}
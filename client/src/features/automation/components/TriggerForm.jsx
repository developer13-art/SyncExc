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

const TRIGGER_TYPES = [
  { value: 'signal_published', label: 'Signal published' },
  { value: 'signal_validated', label: 'Signal validated' },
  { value: 'source_status_changed', label: 'Source status changed' },
  { value: 'sync_event', label: 'Synchronization event' },
  { value: 'order_event', label: 'Order event' },
  { value: 'risk_alert', label: 'Risk alert' },
  { value: 'schedule', label: 'Scheduled time' },
  { value: 'webhook', label: 'Authenticated webhook' },
];

export function TriggerForm({ value, onSubmit, onCancel, isSubmitting, className }) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: value?.type ?? 'signal_published',
      name: value?.name ?? '',
      filter: value?.filter ?? '',
      dedupWindowSeconds: value?.dedupWindowSeconds ?? 300,
    },
  });

  const type = watch('type');
  const requiresFilter = ['signal_published', 'signal_validated', 'source_status_changed'].includes(
    type,
  );

  const submit = handleSubmit((values) => onSubmit?.(values));

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <FormField label="Trigger type" htmlFor="trigger-type" required>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="trigger-type" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          label="Name"
          htmlFor="trigger-name"
          required
          error={errors.name?.message}
        >
          <Input
            id="trigger-name"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
          />
        </FormField>

        {requiresFilter ? (
          <FormField
            label="Event filter"
            htmlFor="trigger-filter"
            hint="Optional filter expression applied to the event before triggering."
          >
            <Input
              id="trigger-filter"
              placeholder="e.g. instrument starts with BTC"
              {...register('filter')}
            />
          </FormField>
        ) : null}

        <FormField
          label="Deduplication window (seconds)"
          htmlFor="trigger-dedup"
          hint="Repeated events within this window are treated as one trigger."
        >
          <Input
            id="trigger-dedup"
            type="text"
            inputMode="numeric"
            {...register('dedupWindowSeconds')}
          />
        </FormField>

        <InfoCallout>
          Triggers that depend on a source module require that module to publish a reliable
          event contract. The workflow engine does not invent events.
        </InfoCallout>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save trigger'}
          </Button>
        </div>
      </div>
    </form>
  );
}
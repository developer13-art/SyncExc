import { Controller, useForm } from 'react-hook-form';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
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
  { value: 'exchange_connection_event', label: 'Exchange connection event' },
  { value: 'sync_operation_event', label: 'Synchronization operation event' },
  { value: 'risk_event', label: 'Risk event' },
  { value: 'circuit_breaker_activated', label: 'Circuit breaker activated' },
  { value: 'workspace_pause_event', label: 'Workspace pause event' },
  { value: 'webhook', label: 'Authenticated webhook' },
];

export function TriggerForm({ value, onSubmit, onCancel, isSubmitting, className }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: value?.type ?? 'signal_published',
      name: value?.name ?? value?.config?.name ?? '',
      filter: value?.filter
        ? JSON.stringify(value.filter, null, 2)
        : value?.config?.filter
          ? JSON.stringify(value.config.filter, null, 2)
          : '',
    },
  });

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
            {...register('name', {
              validate: (value) => value.trim().length > 0 || 'Name is required',
            })}
            error={errors.name?.message}
          />
        </FormField>

        <FormField
          label="Event filter (optional JSON)"
          htmlFor="trigger-filter"
          hint='Match event fields, for example {"symbol":"BTCUSDT"}. Use a JSON object.'
          error={errors.filter?.message}
        >
          <Textarea
            id="trigger-filter"
            rows={3}
            placeholder={'{"symbol":"BTCUSDT"}'}
            error={errors.filter?.message}
            {...register('filter', {
              validate: (value) => {
                if (!value.trim()) return true;
                try {
                  const parsed = JSON.parse(value);
                  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                    ? true
                    : 'Enter a JSON object';
                } catch {
                  return 'Enter a valid JSON object';
                }
              },
            })}
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
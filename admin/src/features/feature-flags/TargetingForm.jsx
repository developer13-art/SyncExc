import { Controller, useForm } from 'react-hook-form';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';

const TARGETING_TYPES = [
  { value: 'users', label: 'Specific users' },
  { value: 'workspaces', label: 'Specific workspaces' },
  { value: 'percentage', label: 'Percentage of eligible traffic' },
  { value: 'region', label: 'Supported regions' },
  { value: 'exchange', label: 'Specific exchange' },
  { value: 'plan', label: 'Subscription plan' },
  { value: 'internal', label: 'Internal test users' },
];

export function TargetingForm({ value, onSubmit, onCancel, isSubmitting }) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: value?.type ?? 'internal',
      value: value?.value ?? '',
      priority: value?.priority ?? 100,
    },
  });

  const type = watch('type');

  const submit = handleSubmit((values) => onSubmit?.(values));

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Alert variant="info" title="Targeting is evaluated server-side">
        <p className="text-xs">
          Hiding a UI control is not an authorization mechanism. Targeting rules are enforced
          at the server for every protected operation.
        </p>
      </Alert>

      <FormField label="Targeting type" htmlFor="targeting-type" required>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="targeting-type" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      {type === 'percentage' ? (
        <FormField
          label="Percentage"
          htmlFor="targeting-value"
          required
          hint="Between 0 and 100."
          error={errors.value?.message}
        >
          <Input
            id="targeting-value"
            type="text"
            inputMode="numeric"
            {...register('value', {
              required: 'Percentage is required',
              validate: (v) =>
                (Number(v) >= 0 && Number(v) <= 100) || 'Must be between 0 and 100',
            })}
            error={errors.value?.message}
          />
        </FormField>
      ) : (
        <FormField
          label="Target value"
          htmlFor="targeting-value"
          required
          hint={
            type === 'users'
              ? 'Comma-separated user IDs'
              : type === 'workspaces'
                ? 'Comma-separated workspace IDs'
                : type === 'region'
                  ? 'Comma-separated regions'
                  : type === 'exchange'
                    ? 'Exchange identifiers'
                    : type === 'plan'
                      ? 'Plan codes'
                      : 'Internal list identifiers'
          }
          error={errors.value?.message}
        >
          <Input
            id="targeting-value"
            {...register('value', { required: 'Value is required' })}
            error={errors.value?.message}
          />
        </FormField>
      )}

      <FormField
        label="Priority"
        htmlFor="targeting-priority"
        hint="Lower priority number is evaluated first."
      >
        <Input
          id="targeting-priority"
          type="text"
          inputMode="numeric"
          {...register('priority')}
        />
      </FormField>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save rule'}
        </Button>
      </div>
    </form>
  );
}
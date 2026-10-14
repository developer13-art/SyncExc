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

const RECURRENCE = [
  { value: 'once', label: 'One-time' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const MISSED_RUN_POLICIES = [
  { value: 'skip', label: 'Skip missed runs' },
  { value: 'run_once', label: 'Run once after recovery' },
  { value: 'catch_up_bounded', label: 'Catch up within a bounded window' },
  { value: 'manual_review', label: 'Require manual review' },
];

export function ScheduleForm({ value, onSubmit, onCancel, isSubmitting, className }) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      recurrence: value?.recurrence ?? 'daily',
      time: value?.time ?? '09:00',
      timezone: value?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      endDate: value?.endDate ?? '',
      missedRunPolicy: value?.missedRunPolicy ?? 'skip',
    },
  });

  const recurrence = watch('recurrence');

  const submit = handleSubmit((values) => onSubmit?.(values));

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <FormField label="Recurrence" htmlFor="schedule-recur" required>
          <Controller
            control={control}
            name="recurrence"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="schedule-recur" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        {recurrence !== 'hourly' ? (
          <FormField label="Time of day" htmlFor="schedule-time" required>
            <Input
              id="schedule-time"
              type="time"
              {...register('time', { required: 'Time is required' })}
              error={errors.time?.message}
            />
          </FormField>
        ) : null}

        <FormField
          label="Timezone"
          htmlFor="schedule-tz"
          required
          hint="Schedule instants are stored in UTC and interpreted using this timezone."
        >
          <Input
            id="schedule-tz"
            {...register('timezone', { required: 'Timezone is required' })}
            error={errors.timezone?.message}
          />
        </FormField>

        <FormField label="End date" htmlFor="schedule-end" hint="Optional">
          <Input id="schedule-end" type="date" {...register('endDate')} />
        </FormField>

        <FormField label="Missed run policy" htmlFor="schedule-missed" required>
          <Controller
            control={control}
            name="missedRunPolicy"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="schedule-missed" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MISSED_RUN_POLICIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <InfoCallout>
          Workflows with consequential side effects default to preventing unintended overlap.
          Consider requiring manual review for missed runs.
        </InfoCallout>

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save schedule'}
          </Button>
        </div>
      </div>
    </form>
  );
}
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
import { Alert } from '../../../components/ui/Alert.jsx';

const CATEGORIES = [
  { value: 'account_access', label: 'Account and access' },
  { value: 'billing_subscription', label: 'Billing and subscription' },
  { value: 'exchange_connections', label: 'Exchange connections' },
  { value: 'orders_execution', label: 'Orders and execution' },
  { value: 'trade_synchronization', label: 'Trade synchronization' },
  { value: 'risk_safety', label: 'Risk and safety' },
  { value: 'signals_sources', label: 'Signals and sources' },
  { value: 'automation_workflows', label: 'Automation and workflows' },
  { value: 'developer_api', label: 'Developer API and webhooks' },
  { value: 'community_collaboration', label: 'Community and collaboration' },
  { value: 'bug_report', label: 'Bug report or feature request' },
  { value: 'other', label: 'Other' },
];

const IMPACT_OPTIONS = [
  { value: 'low', label: 'Low — general question' },
  { value: 'normal', label: 'Normal — ordinary issue' },
  { value: 'high', label: 'High — blocks important work' },
  { value: 'urgent', label: 'Urgent — security or safety concern' },
];

export function TicketForm({ onSubmit, onCancel, isSubmitting, formError, className }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      subject: '',
      category: 'other',
      description: '',
      impact: 'normal',
      affectedResource: '',
    },
  });

  const submit = handleSubmit((values) => onSubmit?.(values));

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <Alert variant="warning" title="Do not share credentials">
          <p className="text-xs">
            Never include passwords, MFA recovery codes, exchange API secrets, private keys, or
            session tokens in a support ticket or attachment. Support staff will never ask for
            them.
          </p>
        </Alert>

        <FormField
          label="Subject"
          htmlFor="ticket-subject"
          required
          error={errors.subject?.message}
        >
          <Input
            id="ticket-subject"
            {...register('subject', {
              required: 'Subject is required',
              minLength: { value: 5, message: 'Please be more specific' },
            })}
            placeholder="Briefly describe the issue"
            error={errors.subject?.message}
          />
        </FormField>

        <FormField label="Category" htmlFor="ticket-category" required>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ticket-category" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          label="Description"
          htmlFor="ticket-description"
          required
          error={errors.description?.message}
          hint="What happened, what did you expect, and any relevant timestamps."
        >
          <Textarea
            id="ticket-description"
            rows={8}
            {...register('description', {
              required: 'Description is required',
              minLength: { value: 20, message: 'Please provide more detail' },
            })}
            placeholder="Describe the issue…"
            error={errors.description?.message}
          />
        </FormField>

        <FormField
          label="Impact"
          htmlFor="ticket-impact"
          hint="High and Urgent tickets are routed to specialist queues."
        >
          <Controller
            control={control}
            name="impact"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ticket-impact" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPACT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField
          label="Affected resource"
          htmlFor="ticket-resource"
          hint="Optional reference to an order, connection, invoice, or workflow."
        >
          <Input
            id="ticket-resource"
            {...register('affectedResource')}
            placeholder="e.g. order ID or connection ID"
          />
        </FormField>

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
            {isSubmitting ? 'Submitting…' : 'Submit ticket'}
          </Button>
        </div>
      </div>
    </form>
  );
}
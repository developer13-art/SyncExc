import { useForm, Controller } from 'react-hook-form';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
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

const SOURCE_TYPES = [
  { value: 'telegram', label: 'Telegram channel or group' },
  { value: 'discord', label: 'Discord server or channel' },
  { value: 'whatsapp', label: 'WhatsApp (where supported)' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'rest_api', label: 'External API' },
  { value: 'website', label: 'Website or public feed' },
];

export function RegisterSourceForm({
  onSubmit,
  onCancel,
  isSubmitting,
  formError,
  className,
  initialType = 'telegram',
  showTypeField = true,
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      type: initialType,
      identifier: '',
      url: '',
      language: '',
      categories: '',
      notes: '',
    },
  });

  const submit = handleSubmit((values) => onSubmit?.(values));

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <FormField
          label="Source name"
          htmlFor="source-name"
          required
          error={errors.name?.message}
          hint="A display name to identify this source."
        >
          <Input
            id="source-name"
            autoFocus
            placeholder="Crypto Signals — Daily"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
          />
        </FormField>

        {showTypeField ? (
          <FormField
            label="Source type"
            htmlFor="source-type"
            required
            error={errors.type?.message}
          >
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="source-type" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        ) : null}

        <FormField
          label="Source identifier"
          htmlFor="source-identifier"
          required
          error={errors.identifier?.message}
          hint="Channel ID, server/channel ID, feed URL, or API endpoint."
        >
          <Input
            id="source-identifier"
            placeholder="@crypto_signals or https://api.example.com/feed"
            {...register('identifier', { required: 'Identifier is required' })}
            error={errors.identifier?.message}
          />
        </FormField>

        <FormField
          label="Reference URL"
          htmlFor="source-url"
          hint="Optional canonical link for navigation."
          error={errors.url?.message}
        >
          <Input
            id="source-url"
            type="url"
            placeholder="https://t.me/crypto_signals"
            {...register('url')}
            error={errors.url?.message}
          />
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Primary language" htmlFor="source-language">
            <Input id="source-language" placeholder="English" {...register('language')} />
          </FormField>

          <FormField label="Categories" htmlFor="source-categories" hint="Comma-separated tags">
            <Input
              id="source-categories"
              placeholder="intraday, futures"
              {...register('categories')}
            />
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="source-notes">
          <Textarea
            id="source-notes"
            rows={2}
            placeholder="Optional context about this source"
            {...register('notes')}
          />
        </FormField>

        <InfoCallout>
          Registration does not automatically authorize ingestion. The source must pass review and
          validation before content is collected.
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
            {isSubmitting ? 'Registering…' : 'Register source'}
          </Button>
        </div>
      </div>
    </form>
  );
}

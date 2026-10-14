import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import { FormError } from '../../../components/forms/FormError.jsx';

export function ProfileForm({
  user,
  onSubmit,
  isSubmitting,
  formError,
  disabled,
  className,
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      displayName: user?.displayName ?? '',
      username: user?.username ?? '',
      preferredLanguage: user?.preferredLanguage ?? 'en',
      timezone: user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      countryCode: user?.countryCode ?? '',
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        displayName: user.displayName ?? '',
        username: user.username ?? '',
        preferredLanguage: user.preferredLanguage ?? 'en',
        timezone: user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        countryCode: user.countryCode ?? '',
      });
    }
  }, [user, reset]);

  const submit = handleSubmit((values) => onSubmit?.(values));

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <FormError>{formError}</FormError>

        <FormField
          label="Display name"
          htmlFor="profile-display-name"
          required
          error={errors.displayName?.message}
        >
          <Input
            id="profile-display-name"
            disabled={disabled}
            {...register('displayName', {
              required: 'Display name is required',
              minLength: { value: 2, message: 'Too short' },
              maxLength: { value: 64, message: 'Too long' },
            })}
            error={errors.displayName?.message}
          />
        </FormField>

        <FormField
          label="Username"
          htmlFor="profile-username"
          error={errors.username?.message}
          hint="Unique under our case-sensitivity policy."
        >
          <Input
            id="profile-username"
            disabled={disabled}
            {...register('username', {
              minLength: { value: 3, message: 'Too short' },
              maxLength: { value: 32, message: 'Too long' },
              pattern: {
                value: /^[a-zA-Z0-9_.-]*$/,
                message: 'Letters, numbers, dot, dash, underscore only',
              },
            })}
            error={errors.username?.message}
          />
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Preferred language"
            htmlFor="profile-language"
            error={errors.preferredLanguage?.message}
          >
            <Input
              id="profile-language"
              disabled={disabled}
              {...register('preferredLanguage')}
            />
          </FormField>

          <FormField
            label="Timezone"
            htmlFor="profile-timezone"
            error={errors.timezone?.message}
            hint="Used to display timestamps in your local time."
          >
            <Input
              id="profile-timezone"
              disabled={disabled}
              {...register('timezone')}
            />
          </FormField>
        </div>

        <FormField
          label="Country or region"
          htmlFor="profile-country"
          hint="Not identity verification. Used for availability and localization rules."
        >
          <Input
            id="profile-country"
            disabled={disabled}
            {...register('countryCode')}
            placeholder="US"
          />
        </FormField>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={disabled || isSubmitting || !isDirty}
          >
            {isSubmitting ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </div>
    </form>
  );
}
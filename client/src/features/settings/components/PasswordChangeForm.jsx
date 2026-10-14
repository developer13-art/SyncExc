import { useForm } from 'react-hook-form';

import { Button } from '../../../components/ui/Button.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import { FormError } from '../../../components/forms/FormError.jsx';
import { PasswordInput } from '../../../components/forms/PasswordInput.jsx';
import { validatePassword } from '../../../lib/validators/password.validator.js';

export function PasswordChangeForm({
  onSubmit,
  isSubmitting,
  formError,
  className,
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = watch('newPassword');

  const submit = handleSubmit(async (values) => {
    await onSubmit?.({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    reset();
  });

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-4">
        <FormError>{formError}</FormError>

        <FormField
          label="Current password"
          htmlFor="password-current"
          required
          error={errors.currentPassword?.message}
        >
          <PasswordInput
            id="password-current"
            autoComplete="current-password"
            {...register('currentPassword', {
              required: 'Current password is required',
            })}
            error={errors.currentPassword?.message}
          />
        </FormField>

        <FormField
          label="New password"
          htmlFor="password-new"
          required
          error={errors.newPassword?.message}
          hint="At least 12 characters with mixed case, number, and symbol."
        >
          <PasswordInput
            id="password-new"
            autoComplete="new-password"
            showStrength
            {...register('newPassword', {
              required: 'New password is required',
              validate: (v) => {
                const result = validatePassword(v);
                return result.valid || result.errors[0];
              },
            })}
            error={errors.newPassword?.message}
          />
        </FormField>

        <FormField
          label="Confirm new password"
          htmlFor="password-confirm"
          required
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="password-confirm"
            autoComplete="new-password"
            {...register('confirmPassword', {
              required: 'Please confirm',
              validate: (v) => v === newPassword || 'Passwords do not match',
            })}
            error={errors.confirmPassword?.message}
          />
        </FormField>

        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          Changing your password will not silently disable MFA. Other active sessions will be
          revoked according to the security policy.
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Change password'}
          </Button>
        </div>
      </div>
    </form>
  );
}
import { useState } from 'react';
import { Eye, EyeOff, Info } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';
import { FormError } from '../../../components/forms/FormError.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';

export function CredentialForm({
  exchangeRequirements = [],
  values = {},
  errors = {},
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
  formError,
}) {
  const [visibleFields, setVisibleFields] = useState({});

  const toggleVisibility = (field) => {
    setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormError>{formError}</FormError>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="flex gap-2 p-4 pt-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Credential security</p>
            <p className="mt-1">
              Credentials are encrypted at rest and never displayed after saving. We recommend
              read-only or trading permissions only — SyncExc does not use withdrawal
              permissions.
            </p>
          </div>
        </CardContent>
      </Card>

      {exchangeRequirements.map((requirement) => {
        const isSecret =
          requirement.type === 'password' ||
          requirement.name?.toLowerCase().includes('secret') ||
          requirement.name?.toLowerCase().includes('passphrase');
        const visible = visibleFields[requirement.name];

        return (
          <FormField
            key={requirement.name}
            label={requirement.label ?? requirement.name}
            htmlFor={`credential-${requirement.name}`}
            required={requirement.required !== false}
            error={errors[requirement.name]}
            hint={requirement.hint}
          >
            <div className="relative">
              <Input
                id={`credential-${requirement.name}`}
                type={isSecret && !visible ? 'password' : 'text'}
                autoComplete="off"
                spellCheck={false}
                placeholder={requirement.placeholder}
                value={values[requirement.name] ?? ''}
                onChange={(e) => onChange?.(requirement.name, e.target.value)}
                error={errors[requirement.name]}
                className={isSecret ? 'pr-10' : ''}
              />
              {isSecret ? (
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <IconButton
                    label={visible ? 'Hide' : 'Show'}
                    size="sm"
                    onClick={() => toggleVisibility(requirement.name)}
                    tabIndex={-1}
                  >
                    {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </IconButton>
                </div>
              ) : null}
            </div>
          </FormField>
        );
      })}

      <div className="mt-2 flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Validating…' : 'Validate and connect'}
        </Button>
      </div>
    </form>
  );
}
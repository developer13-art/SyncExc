import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { consoleApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { parseJsonInput } from './console.utils.js';

function initialValues(fields = []) {
  return Object.fromEntries(
    fields.map((field) => [field.key, field.type === 'boolean' ? false : '']),
  );
}

function FieldControl({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={`console-action-${field.key}`}>
          <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {(field.options || []).map((option) => (
            <SelectItem key={option} value={option}>
              {option.replace(/_/g, ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3 py-2">
        <Switch checked={Boolean(value)} onCheckedChange={onChange} id={`console-action-${field.key}`} />
        <span className="text-sm text-muted-foreground">{value ? 'Enabled' : 'Disabled'}</span>
      </div>
    );
  }

  if (field.type === 'textarea' || field.type === 'json') {
    return (
      <Textarea
        id={`console-action-${field.key}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={field.type === 'json' ? 6 : 3}
        placeholder={field.type === 'json' ? '{ }' : field.label}
        className={field.type === 'json' ? 'font-mono text-xs' : undefined}
      />
    );
  }

  return (
    <Input
      id={`console-action-${field.key}`}
      type={field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.label}
    />
  );
}

export function ConsoleActionDialog({
  open,
  onOpenChange,
  action,
  resourceKey,
  recordId = null,
  recordName = null,
  onCompleted,
}) {
  const toast = useToast();
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fields = useMemo(() => action?.fields || [], [action]);

  useEffect(() => {
    if (open) {
      setValues(initialValues(fields));
      setErrors({});
      setSubmitting(false);
    }
  }, [open, fields]);

  if (!action) return null;

  const setField = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const nextErrors = {};
    for (const field of fields) {
      const value = values[field.key];
      if (field.required && field.type !== 'boolean') {
        const empty = value === undefined || value === null || String(value).trim() === '';
        if (empty) {
          nextErrors[field.key] = `${field.label} is required`;
          continue;
        }
      }
      if (field.minLength && value && String(value).trim().length < field.minLength) {
        nextErrors[field.key] = `${field.label} must be at least ${field.minLength} characters`;
      }
      if (field.type === 'json' && value) {
        try {
          parseJsonInput(value, field.label);
        } catch (error) {
          nextErrors[field.key] = error.message;
        }
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = () => {
    const payload = {};
    for (const field of fields) {
      const raw = values[field.key];
      if (field.type === 'boolean') {
        payload[field.key] = Boolean(raw);
        continue;
      }
      if (raw === undefined || raw === null || String(raw).trim() === '') continue;
      if (field.type === 'json') payload[field.key] = parseJsonInput(raw, field.label);
      else if (field.type === 'number') payload[field.key] = Number(raw);
      else if (field.type === 'datetime') payload[field.key] = new Date(raw).toISOString();
      else payload[field.key] = String(raw).trim();
    }
    return payload;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await consoleApi.action(resourceKey, recordId, action.key, buildPayload());
      toast.success(`${action.label} completed`);
      onOpenChange?.(false);
      onCompleted?.();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (submitting ? null : onOpenChange?.(next))}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{action.label}</DialogTitle>
          <DialogDescription>
            {recordName ? `${recordName} · ` : ''}
            {action.description || 'This action is recorded in the administrative audit log.'}
          </DialogDescription>
        </DialogHeader>

        {action.danger ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This is a sensitive action. A written reason is required and the action is
              attributed to your administrator account.
            </span>
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`console-action-${field.key}`} required={field.required}>
                {field.label}
              </Label>
              <FieldControl
                field={field}
                value={values[field.key]}
                onChange={(value) => setField(field.key, value)}
              />
              {field.minLength ? (
                <p className="text-2xs text-muted-foreground">
                  Minimum {field.minLength} characters.
                </p>
              ) : null}
              {errors[field.key] ? (
                <p className="text-2xs text-destructive">{errors[field.key]}</p>
              ) : null}
            </div>
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant={action.danger ? 'destructive' : 'default'} disabled={submitting}>
              {submitting ? 'Submitting…' : action.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ConsoleActionDialog;

import { useMemo } from 'react';
import { X } from 'lucide-react';

import { IconButton } from '../../../components/ui/IconButton.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Label } from '../../../components/ui/Label.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { Switch } from '../../../components/ui/Switch.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { InfoCallout } from '../../../components/ui/InfoCallout.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function NodeConfigPanel({ node, schema, onChange, onClose, className }) {
  const fields = useMemo(() => schema?.fields ?? [], [schema]);

  if (!node) {
    return null;
  }

  const update = (key, value) => {
    onChange?.(node.id, { ...node.config, [key]: value });
  };

  return (
    <div className={cn('flex h-full flex-col border-l border-border bg-background', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            {node.category}
          </p>
          <p className="truncate text-sm font-medium text-foreground">{node.label}</p>
        </div>
        <IconButton label="Close" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {fields.length === 0 ? (
          <InfoCallout>This node has no configurable fields.</InfoCallout>
        ) : (
          <div className="flex flex-col gap-4">
            {fields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={node.config?.[field.key]}
                onChange={(v) => update(field.key, v)}
              />
            ))}
          </div>
        )}
      </div>

      {node.validationError ? (
        <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          {node.validationError}
        </div>
      ) : null}
    </div>
  );
}

function FieldRenderer({ field, value, onChange }) {
  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <div>
          <Label>{field.label}</Label>
          {field.hint ? (
            <p className="mt-0.5 text-2xs text-muted-foreground">{field.hint}</p>
          ) : null}
        </div>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        <Textarea
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
        {field.hint ? <p className="text-2xs text-muted-foreground">{field.hint}</p> : null}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {field.hint ? <p className="text-2xs text-muted-foreground">{field.hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{field.label}</Label>
      <Input
        type={field.type === 'number' ? 'text' : (field.type ?? 'text')}
        inputMode={field.type === 'number' ? 'decimal' : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
      {field.hint ? <p className="text-2xs text-muted-foreground">{field.hint}</p> : null}
    </div>
  );
}
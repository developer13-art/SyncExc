import { useState } from 'react';

import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { Checkbox } from '../../../components/ui/Checkbox.jsx';
import { FormField } from '../../../components/forms/FormField.jsx';

export function RoleEditor({ open, onOpenChange, role, permissions = [], onSubmit, isSubmitting }) {
  const [form, setForm] = useState({
    name: role?.name ?? '',
    description: role?.description ?? '',
    permissions: role?.permissions ?? [],
  });
  const [error, setError] = useState(null);

  const togglePermission = (key) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await onSubmit?.(form);
      onOpenChange?.(false);
    } catch (err) {
      setError(err?.message ?? 'Save failed');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={role ? 'Edit role' : 'Create role'}
      description="Roles group permissions. Workspace owners can customize roles within platform security boundaries."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save role'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Name" htmlFor="role-name" required>
          <Input
            id="role-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FormField>

        <FormField label="Description" htmlFor="role-description">
          <Textarea
            id="role-description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </FormField>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Permissions</p>
          <div className="max-h-72 overflow-y-auto scrollbar-thin rounded-md border border-border p-3">
            <ul className="flex flex-col gap-2">
              {permissions.map((permission) => {
                const isSelected = form.permissions.includes(permission.key);
                return (
                  <li key={permission.key}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-2 transition hover:bg-muted/40">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePermission(permission.key)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <code className="text-xs font-medium text-foreground">
                            {permission.key}
                          </code>
                        </span>
                        {permission.description ? (
                          <span className="mt-0.5 block text-2xs text-muted-foreground">
                            {permission.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
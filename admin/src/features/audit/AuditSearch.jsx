import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { X } from 'lucide-react';

export function AuditSearch({
  filters,
  onFiltersChange,
  onReset,
  actions = [],
  outcomes = ['success', 'failure', 'blocked', 'denied'],
  modules = [],
}) {
  const update = (key, value) => onFiltersChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        value={filters.q ?? ''}
        onChange={(v) => update('q', v)}
        placeholder="Search by actor, action, resource, or correlation ID…"
        className="w-full"
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Action
          </label>
          <select
            value={filters.action ?? ''}
            onChange={(e) => update('action', e.target.value || undefined)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Any</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Outcome
          </label>
          <select
            value={filters.outcome ?? ''}
            onChange={(e) => update('outcome', e.target.value || undefined)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Any</option>
            {outcomes.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Module
          </label>
          <select
            value={filters.module ?? ''}
            onChange={(e) => update('module', e.target.value || undefined)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Any</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            From
          </label>
          <Input
            type="datetime-local"
            value={filters.from ?? ''}
            onChange={(e) => update('from', e.target.value || undefined)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            To
          </label>
          <Input
            type="datetime-local"
            value={filters.to ?? ''}
            onChange={(e) => update('to', e.target.value || undefined)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-3.5 w-3.5" /> Reset filters
        </Button>
      </div>
    </div>
  );
}
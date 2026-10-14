import { useState } from 'react';
import { Filter, X } from 'lucide-react';

import { SearchInput } from '../forms/SearchInput.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Label } from '../ui/Label.jsx';
import { IconButton } from '../ui/IconButton.jsx';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/Popover.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select.jsx';

const OUTCOMES = [
  { value: 'all', label: 'All outcomes' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'denied', label: 'Denied' },
  { value: 'pending', label: 'Pending' },
];

export function AuditSearchBar({ filters, onChange, className }) {
  const [draft, setDraft] = useState(filters ?? {});

  const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const apply = () => {
    onChange?.(draft);
  };

  const reset = () => {
    const empty = { q: '', action: '', outcome: 'all', dateFrom: '', dateTo: '' };
    setDraft(empty);
    onChange?.(empty);
  };

  const hasActiveFilters = Object.entries(filters ?? {}).some(
    ([key, value]) => key !== 'q' && value !== '' && value !== 'all',
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={draft.q ?? ''}
          onChange={(v) => update('q', v)}
          onDebouncedChange={() => apply()}
          placeholder="Search audit events…"
          className="w-full max-w-md"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" /> Filters
              {hasActiveFilters ? (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-2xs text-primary-foreground">
                  active
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96">
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-foreground">Audit filters</p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter-action">Action</Label>
                  <Input
                    id="filter-action"
                    value={draft.action ?? ''}
                    onChange={(e) => update('action', e.target.value)}
                    placeholder="user_suspended"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter-outcome">Outcome</Label>
                  <Select
                    value={draft.outcome ?? 'all'}
                    onValueChange={(v) => update('outcome', v)}
                  >
                    <SelectTrigger id="filter-outcome">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOMES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter-from">From</Label>
                  <Input
                    id="filter-from"
                    type="date"
                    value={draft.dateFrom ?? ''}
                    onChange={(e) => update('dateFrom', e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="filter-to">To</Label>
                  <Input
                    id="filter-to"
                    type="date"
                    value={draft.dateTo ?? ''}
                    onChange={(e) => update('dateTo', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <IconButton label="Clear filters" size="sm" onClick={reset}>
                  <X className="h-3.5 w-3.5" /> Clear
                </IconButton>
                <Button size="sm" onClick={apply}>
                  Apply filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
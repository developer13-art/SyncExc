import { useMemo, useState } from 'react';
import { Building2, Check, Plus, X } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/Popover.jsx';
import { SearchInput } from '../../../components/forms/SearchInput.jsx';
import { Chip } from '../../../components/ui/Chip.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function DestinationSelector({ accounts = [], value = [], onChange, className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const availableAccounts = useMemo(
    () => accounts.filter((a) => !value.includes(a.id)),
    [accounts, value],
  );

  const filtered = useMemo(() => {
    if (!query) {
      return availableAccounts;
    }
    const q = query.toLowerCase();
    return availableAccounts.filter(
      (a) =>
        a.label?.toLowerCase().includes(q) ||
        a.exchangeName?.toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q),
    );
  }, [availableAccounts, query]);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => value.includes(a.id)),
    [accounts, value],
  );

  const add = (accountId) => {
    onChange?.([...value, accountId]);
    setQuery('');
  };

  const remove = (accountId) => {
    onChange?.(value.filter((id) => id !== accountId));
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {selectedAccounts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedAccounts.map((account) => (
            <Chip key={account.id} onRemove={() => remove(account.id)}>
              <Building2 className="h-3 w-3" />
              <span className="truncate">
                {account.exchangeName} · {account.label ?? account.id}
              </span>
            </Chip>
          ))}
        </div>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <Plus className="h-3.5 w-3.5" />
            Add destination account
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <div className="border-b border-border p-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search accounts…"
              delayMs={150}
            />
          </div>
          <div className="max-h-72 overflow-y-auto scrollbar-thin p-1">
            {filtered.length === 0 ? (
              <EmptyState
                title={query ? 'No matches' : 'All accounts selected'}
                description={
                  query
                    ? 'Try a different search.'
                    : 'Add more connections to expand destination choices.'
                }
                size="sm"
                className="border-0 bg-transparent py-6"
              />
            ) : (
              filtered.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => add(account.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition hover:bg-muted"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {account.label ?? account.id}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {account.exchangeName} · {account.type ?? 'spot'}
                    </span>
                  </span>
                  <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
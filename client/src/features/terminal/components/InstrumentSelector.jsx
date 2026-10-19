import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/Popover.jsx';
import { SearchInput } from '../../../components/forms/SearchInput.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function InstrumentSelector({
  instruments = [],
  value,
  onChange,
  isLoading = false,
  isError = false,
  onRetry,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => instruments.find((i) => i.id === value || i.symbol === value) ?? null,
    [instruments, value],
  );

  const filtered = useMemo(() => {
    if (!query) {
      return instruments.slice(0, 100);
    }
    const q = query.toLowerCase();
    return instruments
      .filter(
        (i) =>
          i.symbol?.toLowerCase().includes(q) ||
          i.baseAsset?.toLowerCase().includes(q) ||
          i.quoteAsset?.toLowerCase().includes(q),
      )
      .slice(0, 100);
  }, [instruments, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-medium', className)}
        >
          {selected ? (
            <span className="flex items-center gap-2">
              <span>{selected.symbol}</span>
              {selected.marketType ? (
                <span className="rounded-full border border-border bg-muted/30 px-1.5 py-0.5 text-2xs uppercase text-muted-foreground">
                  {selected.marketType}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Select instrument</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="border-b border-border p-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search instruments…" delayMs={150} />
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin p-1">
          {isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Loading instruments…
            </p>
          ) : isError ? (
            <EmptyState
              title="Unable to load instruments"
              description="The exchange instrument list could not be loaded."
              action={
                <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                  Retry
                </Button>
              }
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : instruments.length === 0 ? (
            <EmptyState
              title="No instruments available"
              description="Refresh the exchange instrument list and try again."
              action={
                <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                  Refresh list
                </Button>
              }
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Try a different symbol."
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : (
            filtered.map((instrument) => {
              const isSelected = instrument.id === value || instrument.symbol === value;
              return (
                <button
                  key={instrument.id ?? instrument.symbol}
                  type="button"
                  onClick={() => {
                    onChange?.(instrument);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition',
                    'hover:bg-muted',
                    isSelected && 'bg-primary/5',
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {instrument.symbol}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {instrument.baseAsset}/{instrument.quoteAsset}
                      {instrument.marketType ? ` · ${instrument.marketType}` : ''}
                    </span>
                  </span>
                  {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
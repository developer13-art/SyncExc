import { useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover.jsx';
import { Button } from '../ui/Button.jsx';
import { Chip } from '../ui/Chip.jsx';
import { SearchInput } from './SearchInput.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select options',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches',
  maxDisplay = 3,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) {
      return options;
    }
    const q = query.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        String(opt.value).toLowerCase().includes(q),
    );
  }, [options, query]);

  const toggle = (optionValue) => {
    if (value.includes(optionValue)) {
      onChange?.(value.filter((v) => v !== optionValue));
    } else {
      onChange?.([...value, optionValue]);
    }
  };

  const remove = (optionValue) => {
    onChange?.(value.filter((v) => v !== optionValue));
  };

  const selectedOptions = options.filter((opt) => value.includes(opt.value));
  const visibleSelected = selectedOptions.slice(0, maxDisplay);
  const remaining = selectedOptions.length - visibleSelected.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-auto min-h-9 w-full justify-between px-3 py-1.5 font-normal',
            value.length === 0 && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex flex-wrap items-center gap-1.5 text-left">
            {value.length === 0 ? (
              placeholder
            ) : (
              <>
                {visibleSelected.map((opt) => (
                  <Chip
                    key={opt.value}
                    onRemove={(e) => {
                      e?.stopPropagation?.();
                      remove(opt.value);
                    }}
                  >
                    {opt.label}
                  </Chip>
                ))}
                {remaining > 0 ? (
                  <span className="text-xs text-muted-foreground">+{remaining} more</span>
                ) : null}
              </>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="border-b border-border p-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
            delayMs={150}
          />
        </div>
        <div className="max-h-64 overflow-y-auto scrollbar-thin p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            filtered.map((opt) => {
              const selected = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition',
                    'hover:bg-muted',
                    selected && 'bg-primary/5',
                  )}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-foreground">{opt.label}</span>
                    {opt.description ? (
                      <span className="text-2xs text-muted-foreground">{opt.description}</span>
                    ) : null}
                  </span>
                  {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
        {value.length > 0 ? (
          <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
            <button
              type="button"
              onClick={() => onChange?.([])}
              className="flex items-center gap-1 text-2xs text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear all
            </button>
            <span className="text-2xs text-muted-foreground">{value.length} selected</span>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
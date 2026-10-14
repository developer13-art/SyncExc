import { forwardRef, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

import { Input } from '../ui/Input.jsx';
import { IconButton } from '../ui/IconButton.jsx';
import { useDebounce } from '../../hooks/useDebounce.js';
import { cn } from '../../lib/utils/cn.util.js';

export const SearchInput = forwardRef(function SearchInput(
  {
    className,
    value,
    onChange,
    onDebouncedChange,
    placeholder = 'Search…',
    delayMs = 300,
    ...props
  },
  ref,
) {
  const [internal, setInternal] = useState(value ?? '');
  const debounced = useDebounce(internal, delayMs);

  useEffect(() => {
    setInternal(value ?? '');
  }, [value]);

  useEffect(() => {
    onDebouncedChange?.(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const handleChange = (e) => {
    const next = e.target.value;
    setInternal(next);
    onChange?.(next);
  };

  const handleClear = () => {
    setInternal('');
    onChange?.('');
    onDebouncedChange?.('');
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        type="search"
        value={internal}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-9 pr-9"
        {...props}
      />
      {internal ? (
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <IconButton label="Clear search" size="sm" onClick={handleClear}>
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';
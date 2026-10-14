import { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from './Popover.jsx';
import { Button } from './Button.jsx';
import { Input } from './Input.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function DatePicker({ value, onChange, placeholder = 'Pick a date', className }) {
  const [open, setOpen] = useState(false);

  const displayValue = useMemo(() => {
    if (!value) {
      return '';
    }
    const d = typeof value === 'string' ? parseISO(value) : value;
    return isValid(d) ? format(d, 'MMM d, yyyy') : '';
  }, [value]);

  const handleManualChange = (e) => {
    const raw = e.target.value;
    const parsed = parseISO(raw);
    if (isValid(parsed)) {
      onChange?.(parsed.toISOString());
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue || placeholder}
          {value ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange?.(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange?.(null);
                }
              }}
              className="ml-auto rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex flex-col gap-2">
          <Input
            type="date"
            value={value ? format(parseISO(value), 'yyyy-MM-dd') : ''}
            onChange={handleManualChange}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => onChange?.(null)}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
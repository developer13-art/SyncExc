import { forwardRef } from 'react';

import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils/cn.util.js';
import { getCurrencySymbol } from '../../lib/formatters/currency.formatter.js';

export const CurrencyInput = forwardRef(function CurrencyInput(
  { className, value, onChange, currency = 'USD', ...props },
  ref,
) {
  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange?.('');
      return;
    }
    const numeric = raw.replace(/[^\d.]/g, '');
    const parts = numeric.split('.');
    const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : numeric;
    onChange?.(cleaned);
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        {getCurrencySymbol(currency)}
      </span>
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        className={cn('pl-7', className)}
        {...props}
      />
    </div>
  );
});

CurrencyInput.displayName = 'CurrencyInput';
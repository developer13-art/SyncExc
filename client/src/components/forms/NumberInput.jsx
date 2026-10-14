import { forwardRef } from 'react';

import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export const NumberInput = forwardRef(function NumberInput(
  { className, value, onChange, min, max, step = 1, allowDecimal = false, ...props },
  ref,
) {
  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange?.('');
      return;
    }
    let numeric = allowDecimal ? raw.replace(/[^\d.-]/g, '') : raw.replace(/[^\d-]/g, '');

    if (numeric.includes('-') && !numeric.startsWith('-')) {
      numeric = numeric.replace(/-/g, '');
    }
    if ((numeric.match(/\./g) ?? []).length > 1) {
      const [first, ...rest] = numeric.split('.');
      numeric = `${first}.${rest.join('')}`;
    }

    if (numeric !== '' && numeric !== '-') {
      const parsed = Number(numeric);
      if (Number.isFinite(parsed)) {
        if (min !== undefined && parsed < min) {
          onChange?.(String(min));
          return;
        }
        if (max !== undefined && parsed > max) {
          onChange?.(String(max));
          return;
        }
      }
    }

    onChange?.(numeric);
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={value}
      onChange={handleChange}
      step={step}
      className={cn(className)}
      {...props}
    />
  );
});

NumberInput.displayName = 'NumberInput';
import { forwardRef } from 'react';

import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export const PhoneInput = forwardRef(function PhoneInput(
  { className, value, onChange, ...props },
  ref,
) {
  const handleChange = (e) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/[^\d+\s()-]/g, '');
    onChange?.(digitsOnly);
  };

  return (
    <Input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value}
      onChange={handleChange}
      placeholder="+1 (555) 555-5555"
      className={cn(className)}
      {...props}
    />
  );
});

PhoneInput.displayName = 'PhoneInput';
import { useEffect, useRef } from 'react';

import { cn } from '../../lib/utils/cn.util.js';

export function OtpInput({ length = 6, value = '', onChange, autoFocus = true, className }) {
  const inputsRef = useRef([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  useEffect(() => {
    if (autoFocus) {
      inputsRef.current[0]?.focus();
    }
  }, [autoFocus]);

  const setDigit = (index, char) => {
    const clean = char.replace(/\D/g, '');
    if (!clean) {
      return;
    }
    const next = digits.slice();
    next[index] = clean[0];
    onChange?.(next.join('').trimEnd());

    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleChange = (index, e) => {
    const raw = e.target.value;
    if (raw.length > 1) {
      const chars = raw.replace(/\D/g, '').split('');
      const next = digits.slice();
      chars.forEach((c, i) => {
        if (index + i < length) {
          next[index + i] = c;
        }
      });
      onChange?.(next.join('').trimEnd());
      const focusIndex = Math.min(index + chars.length, length - 1);
      inputsRef.current[focusIndex]?.focus();
      return;
    }
    setDigit(index, raw);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = digits.slice();
      if (next[index] && next[index] !== ' ') {
        next[index] = ' ';
        onChange?.(next.join('').trimEnd());
      } else if (index > 0) {
        next[index - 1] = ' ';
        onChange?.(next.join('').trimEnd());
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      onChange?.(pasted);
      const focusIndex = Math.min(pasted.length, length - 1);
      inputsRef.current[focusIndex]?.focus();
    }
  };

  return (
    <div className={cn('flex gap-2', className)}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digits[index] === ' ' ? '' : digits[index]}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={cn(
            'h-12 w-11 rounded-md border border-input bg-background text-center text-lg font-semibold text-foreground shadow-sm transition',
            'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
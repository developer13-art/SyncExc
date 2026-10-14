import { forwardRef, useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';

import { Input } from '../ui/Input.jsx';
import { IconButton } from '../ui/IconButton.jsx';
import { cn } from '../../lib/utils/cn.util.js';
import { checkPasswordStrength } from '../../lib/validators/password.validator.js';

export const PasswordInput = forwardRef(function PasswordInput(
  { className, showStrength = false, value, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength && value ? checkPasswordStrength(value) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          value={value}
          className={cn('pr-10', className)}
          {...props}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <IconButton
            label={visible ? 'Hide password' : 'Show password'}
            size="sm"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </IconButton>
        </div>
      </div>

      {strength ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-1 flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'h-full flex-1 rounded-full transition',
                    i < strength.score
                      ? strength.score <= 1
                        ? 'bg-destructive'
                        : strength.score === 2
                          ? 'bg-warning'
                          : 'bg-success'
                      : 'bg-muted',
                  )}
                />
              ))}
            </div>
            <span className="text-2xs font-medium text-muted-foreground">{strength.label}</span>
          </div>

          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted-foreground">
            <li className="flex items-center gap-1">
              {strength.checks.length ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              12+ characters
            </li>
            <li className="flex items-center gap-1">
              {strength.checks.uppercase ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              Uppercase
            </li>
            <li className="flex items-center gap-1">
              {strength.checks.lowercase ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              Lowercase
            </li>
            <li className="flex items-center gap-1">
              {strength.checks.number ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              Number
            </li>
            <li className="flex items-center gap-1">
              {strength.checks.symbol ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              Symbol
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';
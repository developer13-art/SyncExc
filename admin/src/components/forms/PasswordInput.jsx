import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { IconButton } from '../ui/IconButton.jsx';
import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export const PasswordInput = forwardRef(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <IconButton
          label={visible ? 'Hide password' : 'Show password'}
          size="sm"
          onClick={() => setVisible((current) => !current)}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </IconButton>
      </div>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

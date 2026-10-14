import { Label } from '../ui/Label.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
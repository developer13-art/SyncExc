import { cn } from '../../lib/utils/cn.util.js';

export function FormActions({ children, align = 'end', className }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row',
        align === 'end' && 'sm:justify-end',
        align === 'start' && 'sm:justify-start',
        align === 'between' && 'sm:justify-between',
        className,
      )}
    >
      {children}
    </div>
  );
}
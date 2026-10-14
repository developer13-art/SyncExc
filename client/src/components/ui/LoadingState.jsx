import { Spinner } from './Spinner.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function LoadingState({ label = 'Loading', fullScreen = false, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        fullScreen ? 'min-h-screen w-full' : 'py-12',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size={fullScreen ? 'lg' : 'md'} />
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  );
}
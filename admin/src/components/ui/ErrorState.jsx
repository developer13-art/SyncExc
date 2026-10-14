import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from './Button.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-5">
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
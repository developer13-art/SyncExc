import { Check } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';

export function Stepper({ steps, currentStep = 0, orientation = 'horizontal', className }) {
  const isHorizontal = orientation === 'horizontal';
  return (
    <ol
      className={cn(
        'flex gap-4',
        isHorizontal ? 'flex-row items-center' : 'flex-col',
        className,
      )}
    >
      {steps.map((step, index) => {
        const isComplete = index < currentStep;
        const isActive = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.id ?? index}
            className={cn(
              'flex flex-1 items-center gap-3',
              isHorizontal ? 'min-w-0' : 'items-start',
            )}
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition',
                  isComplete && 'border-primary bg-primary text-primary-foreground',
                  isActive && !isComplete && 'border-primary text-primary',
                  !isComplete && !isActive && 'border-muted text-muted-foreground',
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {!isLast && isHorizontal ? (
                <div
                  className={cn(
                    'absolute',
                    'hidden',
                  )}
                />
              ) : null}
            </div>
            <div className={cn('min-w-0', isHorizontal ? 'pr-4' : '')}>
              <p
                className={cn(
                  'text-sm font-medium',
                  isActive || isComplete ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.title}
              </p>
              {step.description ? (
                <p className="text-xs text-muted-foreground">{step.description}</p>
              ) : null}
            </div>
            {!isLast && isHorizontal ? (
              <div
                className={cn(
                  'h-0.5 flex-1',
                  isComplete ? 'bg-primary' : 'bg-border',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
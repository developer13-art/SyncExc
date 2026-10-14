import { Users, TrendingUp } from 'lucide-react';

import { cn } from '../../../lib/utils/cn.util.js';

export function ConsensusIndicator({ providers = [], agreement, className }) {
  const providerCount = providers.length;
  const agreementPercent = typeof agreement === 'number' ? Math.round(agreement * 100) : null;

  if (providerCount === 0) {
    return null;
  }

  const tone =
    agreementPercent === null
      ? 'text-muted-foreground'
      : agreementPercent >= 75
        ? 'text-success'
        : agreementPercent >= 50
          ? 'text-warning'
          : 'text-destructive';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5',
        className,
      )}
    >
      <Users className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-foreground">
        {providerCount} provider{providerCount !== 1 ? 's' : ''}
      </span>
      {agreementPercent !== null ? (
        <>
          <span className="text-muted-foreground">·</span>
          <span className={cn('flex items-center gap-1 text-xs font-medium', tone)}>
            <TrendingUp className="h-3 w-3" />
            {agreementPercent}% agreement
          </span>
        </>
      ) : null}
    </div>
  );
}
import { ShieldAlert } from 'lucide-react';

import { cn } from '../../../lib/utils/cn.util.js';

export function SignalRiskAnalysis({ analysis, className }) {
  if (!analysis) {
    return null;
  }

  const { riskRewardRatio, riskAmount, potentialReturn, warnings = [] } = analysis;

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">Risk Analysis</h4>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        {riskRewardRatio !== undefined ? (
          <div>
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">R:R</p>
            <p
              className={cn(
                'mt-0.5 font-semibold',
                riskRewardRatio >= 2
                  ? 'text-success'
                  : riskRewardRatio >= 1
                    ? 'text-warning'
                    : 'text-destructive',
              )}
            >
              {riskRewardRatio.toFixed(2)}
            </p>
          </div>
        ) : null}
        {riskAmount !== undefined ? (
          <div>
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Risk</p>
            <p className="mt-0.5 font-semibold text-foreground">{riskAmount}</p>
          </div>
        ) : null}
        {potentialReturn !== undefined ? (
          <div>
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Reward</p>
            <p className="mt-0.5 font-semibold text-foreground">{potentialReturn}</p>
          </div>
        ) : null}
      </div>

      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {warnings.map((warning, i) => (
            <li key={i} className="text-xs text-warning">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
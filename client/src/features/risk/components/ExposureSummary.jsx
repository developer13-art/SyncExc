import { AlertTriangle, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function ExposureSummary({ exposure, currency = 'USD', className }) {
  if (!exposure) {
    return null;
  }

  const {
    grossExposure,
    netExposure,
    pendingExposure,
    accountCount,
    staleAccountCount,
    incompleteAccountCount,
  } = exposure;

  const hasStaleData = staleAccountCount > 0 || incompleteAccountCount > 0;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Exposure</CardTitle>
          {hasStaleData ? (
            <span className="flex items-center gap-1 rounded-full border border-warning/30 bg-warning/5 px-2 py-0.5 text-2xs font-medium text-warning">
              <AlertTriangle className="h-3 w-3" />
              Partial data
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Metric
          label="Gross exposure"
          value={formatCurrency(grossExposure ?? 0, currency)}
          hint="Total size of positions without netting"
          icon={TrendingUp}
        />
        <Metric
          label="Net exposure"
          value={formatCurrency(netExposure ?? 0, currency)}
          hint="Where meaningful netting applies"
        />
        <Metric
          label="Pending exposure"
          value={formatCurrency(pendingExposure ?? 0, currency)}
          hint="Open orders not yet filled"
        />
        <Metric
          label="Accounts covered"
          value={accountCount ?? 0}
          hint={
            hasStaleData
              ? `${staleAccountCount ?? 0} stale, ${incompleteAccountCount ?? 0} incomplete`
              : 'All accounts fresh'
          }
          tone={hasStaleData ? 'warning' : undefined}
        />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, hint, icon: Icon, tone }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-2xs uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold',
          tone === 'warning' ? 'text-warning' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
import { cn } from '../../../lib/utils/cn.util.js';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';

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
  } = exposure;

  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-4', className)}>
      <Metric label="Gross Exposure" value={formatCurrency(grossExposure, currency)} />
      <Metric label="Net Exposure" value={formatCurrency(netExposure, currency)} />
      <Metric label="Pending" value={formatCurrency(pendingExposure ?? 0, currency)} />
      <Metric
        label="Accounts"
        value={`${accountCount ?? 0}${staleAccountCount > 0 ? ` · ${staleAccountCount} stale` : ''}`}
        tone={staleAccountCount > 0 ? 'warning' : undefined}
      />
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-sm font-semibold',
          tone === 'warning' ? 'text-warning' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}
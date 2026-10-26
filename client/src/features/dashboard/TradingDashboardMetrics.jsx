import { Activity, ChartNoAxesCombined, Wallet } from 'lucide-react';

import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

export function TradingDashboardMetrics({ overview, positions = [], isLoading, error }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Portfolio metrics are temporarily unavailable.
      </div>
    );
  }

  const currency = overview?.baseCurrency ?? 'USD';
  const unrealizedPnl = positions.reduce((sum, position) => {
    const value = Number(position.unrealizedPnl);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const metrics = [
    {
      label: overview?.portfolioValueEstimated ? 'Portfolio value · estimated' : 'Portfolio value',
      value: overview?.portfolioValue == null ? '—' : formatCurrency(overview.portfolioValue, currency),
      hint: overview?.portfolioValueEstimated ? 'Based on latest available asset prices' : 'Across connected accounts',
      icon: Wallet,
      tone: 'default',
    },
    {
      label: 'Unrealized P&L',
      value: positions.length ? formatCurrency(unrealizedPnl, currency) : '—',
      hint: positions.length ? `Across ${positions.length} open position${positions.length === 1 ? '' : 's'}` : 'No open positions',
      icon: ChartNoAxesCombined,
      tone: unrealizedPnl > 0 ? 'success' : unrealizedPnl < 0 ? 'destructive' : 'default',
    },
    {
      label: 'Realized P&L · all time',
      value: overview?.closedTrades?.totalRealizedPnl == null
        ? '—'
        : formatCurrency(overview.closedTrades.totalRealizedPnl, currency),
      hint: `Closed trades · ${overview?.closedTrades?.count ?? 0} · Today ${
        overview?.realizedPnlToday == null
          ? '—'
          : formatCurrency(overview.realizedPnlToday, currency)
      }`,
      icon: Activity,
      tone: Number(overview?.closedTrades?.totalRealizedPnl) > 0
        ? 'success'
        : Number(overview?.closedTrades?.totalRealizedPnl) < 0
          ? 'destructive'
          : 'default',
    },
    {
      label: 'Open positions',
      value: String(positions.length),
      hint: `${overview?.activeConnectionCount ?? 0} active exchange connection${overview?.activeConnectionCount === 1 ? '' : 's'}`,
      icon: Activity,
      tone: 'default',
    },
  ];
  const toneClasses = {
    default: 'text-foreground',
    success: 'text-success',
    destructive: 'text-destructive',
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      {metrics.map(({ label, value, hint, icon: Icon, tone }) => (
        <div key={label} className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs">
                {label}
              </p>
              <p className={`mt-2 break-words text-base font-semibold leading-tight tracking-tight sm:text-2xl ${toneClasses[tone]}`}>
                {value}
              </p>
              <p className="mt-1 break-words text-[10px] leading-snug text-muted-foreground sm:text-xs">
                {hint}
              </p>
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-9 sm:w-9">
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

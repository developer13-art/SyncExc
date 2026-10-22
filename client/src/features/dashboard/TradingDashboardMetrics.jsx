import { Activity, ChartNoAxesCombined, Wallet } from 'lucide-react';

import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

export function TradingDashboardMetrics({ overview, positions = [], isLoading, error }) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={overview?.portfolioValueEstimated ? 'Portfolio value · estimated' : 'Portfolio value'}
        value={overview?.portfolioValue == null ? '—' : formatCurrency(overview.portfolioValue, currency)}
        hint={overview?.portfolioValueEstimated ? 'Based on latest available asset prices' : 'Across connected accounts'}
        icon={Wallet}
      />
      <StatCard
        label="Unrealized P&L"
        value={positions.length ? formatCurrency(unrealizedPnl, currency) : '—'}
        hint={positions.length ? `Across ${positions.length} open position${positions.length === 1 ? '' : 's'}` : 'No open positions'}
        icon={ChartNoAxesCombined}
        tone={unrealizedPnl > 0 ? 'success' : unrealizedPnl < 0 ? 'destructive' : 'default'}
      />
      <StatCard
        label="Realized today"
        value={overview?.realizedPnlToday == null ? '—' : formatCurrency(overview.realizedPnlToday, currency)}
        hint={overview?.startingEquityToday ? 'Today’s closed trade results' : 'Closed trade results'}
        icon={Activity}
        tone={Number(overview?.realizedPnlToday) > 0 ? 'success' : Number(overview?.realizedPnlToday) < 0 ? 'destructive' : 'default'}
      />
      <StatCard
        label="Open positions"
        value={String(positions.length)}
        hint={`${overview?.activeConnectionCount ?? 0} active exchange connection${overview?.activeConnectionCount === 1 ? '' : 's'}`}
        icon={Activity}
      />
    </div>
  );
}

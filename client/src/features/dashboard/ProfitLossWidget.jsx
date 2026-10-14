import { Activity, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { StatCard } from '../../components/ui/StatCard.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatPercent } from '../../lib/formatters/percent.formatter.js';

export function ProfitLossWidget({ overview, positions = [], isLoading, error }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Unable to load portfolio summary. Please refresh.
      </div>
    );
  }

  const portfolioValue = overview?.portfolioValue ?? 0;
  const currency = overview?.baseCurrency ?? 'USD';
  const unrealizedPnl = positions.reduce((sum, p) => sum + Number(p.unrealizedPnl ?? 0), 0);
  const realizedToday = overview?.realizedPnlToday ?? 0;
  const openPositionsCount = positions.length;

  const unrealizedTone =
    unrealizedPnl > 0 ? 'success' : unrealizedPnl < 0 ? 'destructive' : 'default';
  const realizedTone =
    realizedToday > 0 ? 'success' : realizedToday < 0 ? 'destructive' : 'default';

  const realizedPercent =
    overview?.startingEquityToday && overview.startingEquityToday !== 0
      ? (realizedToday / overview.startingEquityToday) * 100
      : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Portfolio Value"
        value={formatCurrency(portfolioValue, currency)}
        hint={
          overview?.portfolioChange24hPercent !== undefined
            ? `${formatPercent(overview.portfolioChange24hPercent, { showSign: true, already100: true })} in last 24h`
            : null
        }
        icon={Wallet}
      />

      <StatCard
        label="Unrealized P&L"
        value={formatCurrency(Math.abs(unrealizedPnl), currency)}
        hint={`Across ${openPositionsCount} open position${openPositionsCount !== 1 ? 's' : ''}`}
        icon={unrealizedPnl >= 0 ? TrendingUp : TrendingDown}
        tone={unrealizedTone}
      />

      <StatCard
        label="Realized Today"
        value={formatCurrency(Math.abs(realizedToday), currency)}
        hint={
          realizedPercent
            ? `${formatPercent(realizedPercent, { showSign: true, decimals: 2 })} of equity`
            : null
        }
        icon={realizedToday >= 0 ? TrendingUp : TrendingDown}
        tone={realizedTone}
      />

      <StatCard
        label="Active Connections"
        value={`${overview?.activeConnectionCount ?? 0} / ${overview?.totalConnectionCount ?? 0}`}
        hint={
          overview?.degradedConnectionCount > 0
            ? `${overview.degradedConnectionCount} degraded`
            : 'All connections healthy'
        }
        icon={Activity}
        tone={overview?.degradedConnectionCount > 0 ? 'warning' : 'default'}
      />
    </div>
  );
}
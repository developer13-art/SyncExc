import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { PerformanceChart } from './components/PerformanceChart.jsx';
import { useMarketplaceProvider } from '../../hooks/useMarketplace.js';
import { formatPercent } from '../../lib/formatters/percent.formatter.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

export function ProviderPerformance({ providerId }) {
  const providerQuery = useMarketplaceProvider(providerId);

  if (providerQuery.isLoading) {
    return <LoadingState label="Loading performance" />;
  }

  const performance = providerQuery.performance;
  const methodology = performance?.methodology;

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Performance information is presented separately from provider-reported statistics.
          Where SyncExc cannot calculate a metric reliably, this page displays insufficient
          data rather than a guessed value.
        </CardContent>
      </Card>

      <PerformanceChart
        performance={performance}
        isLoading={providerQuery.performanceIsLoading}
        error={providerQuery.performanceError}
        onRetry={providerQuery.refetchPerformance}
      />

      {performance?.metrics ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Performance summary</CardTitle>
              {methodology?.source ? (
                <Badge variant="info">
                  {methodology.source === 'independent' ? 'Independently calculated' : 'Provider-reported'}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {performance.metrics.totalSignals !== undefined ? (
              <Metric label="Signals" value={performance.metrics.totalSignals} />
            ) : null}
            {performance.metrics.observedExecutions !== undefined ? (
              <Metric label="Exact closed executions" value={performance.metrics.observedExecutions} />
            ) : null}
            {performance.metrics.winRate !== undefined ? (
              <Metric
                label="Win rate"
                value={formatPercent(performance.metrics.winRate, {
                  decimals: 1,
                  already100: true,
                })}
              />
            ) : null}
            {performance.metrics.averageRR !== undefined ? (
              <Metric label="Average R:R" value={performance.metrics.averageRR.toFixed(2)} />
            ) : null}
            {performance.metrics.maxDrawdown !== undefined ? (
              <Metric
                label="Max drawdown"
                value={formatPercent(performance.metrics.maxDrawdown, {
                  decimals: 1,
                  already100: true,
                })}
                tone="destructive"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {performance?.metrics?.realizedPnlByAsset?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Realized PnL by settlement asset</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {performance.metrics.realizedPnlByAsset.map((item) => (
              <Metric
                key={item.asset}
                label={`${item.asset} · ${item.observedExecutions} closed executions`}
                value={formatCurrency(item.netPnl, item.asset === 'UNKNOWN' ? '' : item.asset)}
                tone={Number(item.netPnl) < 0 ? 'destructive' : undefined}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {methodology ? (
        <Card>
          <CardHeader>
            <CardTitle>Methodology</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
            {methodology.description ? <p>{methodology.description}</p> : null}
            {methodology.dataRange ? (
              <p>Data range: {methodology.dataRange}</p>
            ) : null}
            {methodology.exclusions ? (
              <p>Exclusions: {methodology.exclusions}</p>
            ) : null}
            {methodology.methodologyVersion ? (
              <p className="font-mono text-2xs">
                Version: {methodology.methodologyVersion}
              </p>
            ) : null}
            <p className="border-t border-border pt-3">
              Historical outcomes do not guarantee future results. Sample size, market
              conditions, and execution assumptions affect any calculation.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'destructive'
            ? 'mt-0.5 text-lg font-semibold text-destructive'
            : 'mt-0.5 text-lg font-semibold text-foreground'
        }
      >
        {value}
      </p>
    </div>
  );
}
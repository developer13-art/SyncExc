import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, RefreshCw } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { consoleApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { ConsoleTrendChart } from './ConsoleTrendChart.jsx';
import { formatSummaryValue } from './console.utils.js';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

function BreakdownBar({ item, max }) {
  const width = max > 0 ? Math.max(2, Math.round((item.value / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-foreground">{item.label || 'Unknown'}</span>
        <span className="tabular-nums text-muted-foreground">{item.value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ConsoleAnalytics({ page, section }) {
  const [days, setDays] = useState('30');
  const analyticsQuery = useQuery({
    queryKey: queryKeys.console.analytics(page.sectionId, { days }),
    queryFn: () => consoleApi.analytics(page.sectionId, { days }),
  });

  const data = analyticsQuery.data;
  const cards = data?.cards ?? [];
  const trends = data?.trends ?? [];
  const breakdowns = data?.breakdowns ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {section.label}
                </p>
                <Badge variant="info" size="sm">Live aggregates</Badge>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {page.pageId === 'platform-analytics' ? 'Platform analytics' : 'Analytics'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Aggregates are computed directly from platform records for the selected period.
                Failed queries are reported per card instead of hiding the rest of the report.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[11rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <IconButton
              label="Refresh analytics"
              onClick={() => analyticsQuery.refetch()}
              disabled={analyticsQuery.isFetching}
              className="border border-border bg-background/70"
            >
              <RefreshCw className={analyticsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </IconButton>
          </div>
        </div>
      </div>

      {analyticsQuery.isLoading ? (
        <LoadingState label="Computing analytics" />
      ) : analyticsQuery.isError ? (
        <ErrorState
          title="Analytics unavailable"
          description={getErrorMessage(analyticsQuery.error)}
          onRetry={() => analyticsQuery.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <div key={card.key} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {formatSummaryValue(card.key, card.value)}
                </p>
                {card.error ? (
                  <p className="mt-1 text-2xs text-warning">This metric could not be computed.</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {trends.map((trend) => (
              <Card key={trend.key}>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{trend.label}</CardTitle>
                    {trend.error ? <Badge variant="warning" size="sm">Partial</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <ConsoleTrendChart points={trend.points} series={trend.series} />
                </CardContent>
              </Card>
            ))}
          </div>

          {breakdowns.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {breakdowns.map((breakdown) => {
                const items = breakdown.items ?? [];
                const max = items.reduce((current, item) => Math.max(current, item.value), 0);
                return (
                  <Card key={breakdown.key}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle>{breakdown.label}</CardTitle>
                        {breakdown.error ? <Badge variant="warning" size="sm">Partial</Badge> : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No data in this period.</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {items.map((item) => (
                            <BreakdownBar key={`${breakdown.key}-${item.label}`} item={item} max={max} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default ConsoleAnalytics;

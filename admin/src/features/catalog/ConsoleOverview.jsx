import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, Database, RefreshCw } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { consoleApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { ConsoleTrendChart } from './ConsoleTrendChart.jsx';
import { ConsoleValue } from './ConsoleValue.jsx';
import {
  buildQueryParams,
  findDefaultListPage,
  formatSummaryValue,
  humanize,
} from './console.utils.js';

function BreakdownList({ items }) {
  const max = (items ?? []).reduce((current, item) => Math.max(current, item.value), 0);
  if (!items?.length) {
    return <p className="text-xs text-muted-foreground">No data in this period.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="flex items-center justify-between gap-3 text-xs">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-1.5 shrink-0 rounded-full bg-primary"
              style={{ width: `${max > 0 ? Math.max(6, (item.value / max) * 48) : 6}px` }}
            />
            <span className="truncate text-foreground">{humanize(item.label) || 'Unknown'}</span>
          </span>
          <span className="tabular-nums text-muted-foreground">{item.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function ConsoleOverview({ page, section }) {
  const navigate = useNavigate();
  const resource = page.resource;
  const listPage = findDefaultListPage(section.id, page.pageId);

  const analyticsQuery = useQuery({
    queryKey: queryKeys.console.analytics(page.sectionId, { days: '30' }),
    queryFn: () => consoleApi.analytics(page.sectionId, { days: '30' }),
  });

  const recentParams = buildQueryParams({
    preset: page.preset,
    page: 1,
    pageSize: 8,
    sort: resource?.defaultSort,
    direction: 'desc',
  });

  const recentQuery = useQuery({
    queryKey: queryKeys.console.list(resource?.key, recentParams),
    queryFn: () => consoleApi.list(resource.key, recentParams),
    enabled: Boolean(resource),
  });

  const cards = analyticsQuery.data?.cards ?? [];
  const trends = analyticsQuery.data?.trends ?? [];
  const breakdowns = analyticsQuery.data?.breakdowns ?? [];
  const records = recentQuery.data?.items ?? [];

  const columns = resource
    ? resource.columns.slice(0, 5).map((column) => ({
      key: column.key,
      label: column.label,
      render: (row) => <ConsoleValue column={column} row={row} />,
    }))
    : [];

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
                <Badge variant="info" size="sm">Operational overview</Badge>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {humanize(page.pageId)}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Key aggregates and the most recent records for this area. Select a record to open
                its full detail, notes and audit trail.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {resource && listPage ? (
              <Button asChild>
                <Link to={listPage.path}>
                  Browse all records
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <IconButton
              label="Refresh overview"
              onClick={() => {
                analyticsQuery.refetch();
                if (resource) recentQuery.refetch();
              }}
              disabled={analyticsQuery.isFetching}
              className="border border-border bg-background/70"
            >
              <RefreshCw className={analyticsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </IconButton>
          </div>
        </div>
      </div>

      {analyticsQuery.isLoading ? (
        <LoadingState label="Loading overview" />
      ) : analyticsQuery.isError ? (
        <ErrorState
          title="Overview unavailable"
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
                  <p className="mt-1 text-2xs text-warning">Metric could not be computed.</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {trends.slice(0, 2).map((trend) => (
              <Card key={trend.key}>
                <CardHeader className="pb-0">
                  <CardTitle>{trend.label}</CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <ConsoleTrendChart points={trend.points} series={trend.series} />
                </CardContent>
              </Card>
            ))}
          </div>

          {breakdowns.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {breakdowns.slice(0, 3).map((breakdown) => (
                <Card key={breakdown.key}>
                  <CardHeader className="pb-2">
                    <CardTitle>{breakdown.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BreakdownList items={breakdown.items} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </>
      )}

      {resource ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 p-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent {resource.label.toLowerCase()}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Latest {records.length.toLocaleString()} records matching this overview.
              </p>
            </div>
            {listPage ? (
              <Button asChild variant="outline" size="sm">
                <Link to={listPage.path}>
                  Open full list
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
          <CardContent className="p-4">
            <DataTable
              columns={columns}
              rows={records}
              rowKey={(row) => row.id}
              isLoading={recentQuery.isLoading}
              emptyIcon={Database}
              emptyTitle="No recent records"
              emptyDescription="Records will appear here as activity is recorded."
              onRowClick={(row) => {
                if (listPage) {
                  navigate(`/catalog/${page.sectionId}/${listPage.id}/${row.id}`);
                }
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default ConsoleOverview;

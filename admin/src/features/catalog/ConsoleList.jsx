import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Download, FilterX, RefreshCw, Search } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { consoleApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { useToast } from '../../hooks/useToast.js';
import { ConsoleActionDialog } from './ConsoleActionDialog.jsx';
import { ConsoleTrendChart } from './ConsoleTrendChart.jsx';
import { ConsoleValue } from './ConsoleValue.jsx';
import {
  buildQueryParams,
  formatSummaryValue,
  humanize,
  statusVariant,
  triggerBlobDownload,
} from './console.utils.js';

const ALL = '__all__';

function presetFilterValues(preset, filters) {
  if (!preset) return {};
  const values = {};
  for (const filter of filters) {
    if (preset[filter.key] !== undefined && preset[filter.key] !== null) {
      values[filter.key] = String(preset[filter.key]);
    }
  }
  return values;
}

export function ConsoleList({ page, section }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const resource = page.resource;
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState(resource?.defaultSort || null);
  const [direction, setDirection] = useState('desc');
  const [filters, setFilters] = useState(() => presetFilterValues(page.preset, resource?.filters || []));
  const [actionDialog, setActionDialog] = useState(null);
  const [exporting, setExporting] = useState(false);
  const pagination = usePagination({ initialPageSize: 25 });

  const queryParams = useMemo(
    () => buildQueryParams({
      search,
      filters,
      preset: page.preset,
      from,
      to,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort,
      direction,
    }),
    [search, filters, page.preset, from, to, pagination.page, pagination.pageSize, sort, direction],
  );

  const summaryParams = useMemo(
    () => buildQueryParams({ filters, preset: page.preset, from, to }),
    [filters, page.preset, from, to],
  );

  const listQuery = useQuery({
    queryKey: queryKeys.console.list(resource?.key, queryParams),
    queryFn: () => consoleApi.list(resource.key, queryParams),
    enabled: Boolean(resource),
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.console.summary(resource?.key, summaryParams),
    queryFn: () => consoleApi.summary(resource.key, summaryParams),
    enabled: Boolean(resource),
  });

  const rows = listQuery.data?.items ?? [];

  useEffect(() => {
    const total = listQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [listQuery.data?.meta?.total, pagination.setTotal]);

  if (!resource) {
    return (
      <EmptyState
        icon={Database}
        title="No data source for this page"
        description="This navigation page is not linked to an allow-listed admin resource."
      />
    );
  }

  const recordActions = resource.actions.filter((action) => (action.scope || 'record') === 'record');
  const collectionActions = resource.actions.filter((action) => action.scope === 'resource');
  const canManage = page.permissions?.manage;

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    pagination.goToPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setFrom('');
    setTo('');
    setSearch('');
    pagination.goToPage(1);
  };

  const hasActiveFilters = Boolean(
    search
    || from
    || to
    || Object.values(filters).some((value) => value !== undefined && value !== null && value !== ''),
  );

  const columns = [
    ...resource.columns.map((column) => ({
      key: column.key,
      label: column.label,
      sortable: true,
      render: (row) => <ConsoleValue column={column} row={row} />,
    })),
    ...(canManage && recordActions.length > 0
      ? [{
        key: '__actions',
        label: 'Actions',
        width: '12rem',
        render: (row) => (
          <div className="flex flex-wrap justify-end gap-1">
            {recordActions.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant="outline"
                className={action.danger ? 'text-destructive hover:text-destructive' : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  setActionDialog({ action, record: row });
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ),
      }]
      : []),
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = buildQueryParams({
        search,
        filters,
        preset: page.preset,
        from,
        to,
      });
      const { blob, filename } = await consoleApi.exportCsv(resource.key, params);
      triggerBlobDownload(blob, filename);
      toast.success(`Exported ${resource.label.toLowerCase()}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const summaryCards = summaryQuery.data?.cards ?? [];
  const trend = summaryQuery.data?.trend ?? [];
  const presetBadges = Object.entries(page.preset || {}).filter(
    ([key]) => !resource.filters.some((filter) => filter.key === key),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {section.label}
                </p>
                <Badge variant="muted" size="sm">{resource.label}</Badge>
                {presetBadges.map(([key, value]) => (
                  <Badge key={key} variant={statusVariant(value)} size="sm">
                    {humanize(key)}: {humanize(String(value))}
                  </Badge>
                ))}
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {page.display === 'overview' ? `${section.label} overview` : humanize(page.pageId)}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Live records from the {resource.label.toLowerCase()} resource. Every change is
                validated, permission-checked and written to the audit log.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage
              ? collectionActions.map((action) => (
                <Button
                  key={action.key}
                  variant={action.danger ? 'outline' : 'default'}
                  onClick={() => setActionDialog({ action, record: null })}
                >
                  {action.label}
                </Button>
              ))
              : null}
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <IconButton
              label="Refresh records"
              onClick={() => {
                listQuery.refetch();
                summaryQuery.refetch();
              }}
              disabled={listQuery.isLoading}
              className="border border-border bg-background/70"
            >
              <RefreshCw className={listQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            </IconButton>
          </div>
        </div>
        {summaryCards.length > 0 ? (
          <div className="grid border-t border-border/70 bg-background/30 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.key} className="border-b border-border/70 p-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {formatSummaryValue(card.key, card.value)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {trend.length > 0 ? (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Last 30 days</h2>
                <p className="text-xs text-muted-foreground">New records matching the current filters.</p>
              </div>
              <Badge variant="info" size="sm">Daily</Badge>
            </div>
            <ConsoleTrendChart
              points={trend}
              series={[{ key: 'count', label: 'Records' }]}
              height={180}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{resource.label}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {listQuery.isFetching
                  ? 'Refreshing records…'
                  : `Showing ${rows.length.toLocaleString()} of ${pagination.total.toLocaleString()} records`}
              </p>
            </div>
            {canManage ? (
              <Badge variant="success" size="sm">Manage permission</Badge>
            ) : (
              <Badge variant="muted" size="sm">Read only</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {resource.searchable ? (
              <div className="min-w-[16rem] flex-1">
                <SearchInput
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    pagination.goToPage(1);
                  }}
                  placeholder={`Search ${resource.label.toLowerCase()}…`}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Search className="h-3.5 w-3.5" /> This resource is not full-text searchable.
              </div>
            )}

            {(resource.filters || []).map((filter) => (
              <div key={filter.key} className="min-w-[10rem]">
                <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  {filter.label}
                </p>
                {filter.options?.length ? (
                  <Select
                    value={filters[filter.key] || ALL}
                    onValueChange={(value) => updateFilter(filter.key, value === ALL ? '' : value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={`Any ${filter.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Any {filter.label.toLowerCase()}</SelectItem>
                      {filter.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {humanize(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={filters[filter.key] || ''}
                    onChange={(event) => updateFilter(filter.key, event.target.value)}
                    placeholder={`Filter by ${filter.label.toLowerCase()}`}
                  />
                )}
              </div>
            ))}

            <div className="flex items-end gap-2">
              <div>
                <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">From</p>
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    pagination.goToPage(1);
                  }}
                  className="h-9 w-[9.5rem]"
                />
              </div>
              <div>
                <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">To</p>
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    pagination.goToPage(1);
                  }}
                  className="h-9 w-[9.5rem]"
                />
              </div>
            </div>

            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mb-0.5">
                <FilterX className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>
        </div>

        <CardContent className="p-4">
          {listQuery.isError ? (
            <ErrorState
              title="Could not load records"
              description={getErrorMessage(listQuery.error)}
              onRetry={() => listQuery.refetch()}
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                isLoading={listQuery.isLoading}
                emptyIcon={Database}
                emptyTitle={hasActiveFilters ? 'No matching records' : 'No records yet'}
                emptyDescription={
                  hasActiveFilters
                    ? 'Try adjusting the search, filters or date range.'
                    : 'Records will appear here as the platform records activity.'
                }
                sortKey={sort}
                sortDirection={direction}
                onSortChange={(key, nextDirection) => {
                  if (key === '__actions') return;
                  setSort(key);
                  setDirection(nextDirection);
                }}
                onRowClick={(row) => navigate(`/catalog/${page.sectionId}/${page.pageId}/${row.id}`)}
              />

              {pagination.total > pagination.pageSize ? (
                <div className="mt-4 flex justify-end">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={pagination.goToPage}
                    hasNext={pagination.hasNext}
                    hasPrev={pagination.hasPrev}
                  />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <ConsoleActionDialog
        open={Boolean(actionDialog)}
        onOpenChange={(open) => {
          if (!open) setActionDialog(null);
        }}
        action={actionDialog?.action}
        resourceKey={resource.key}
        recordId={actionDialog?.record?.id ?? null}
        recordName={
          actionDialog?.record && resource.columns[0]
            ? String(actionDialog.record[resource.columns[0].key] ?? actionDialog.record.id)
            : null
        }
        onCompleted={() => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'console'] });
          listQuery.refetch();
          summaryQuery.refetch();
        }}
      />
    </div>
  );
}

export default ConsoleList;

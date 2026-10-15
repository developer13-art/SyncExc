import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { usePagination } from '../../hooks/usePagination.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_VARIANTS = {
  draft: 'muted',
  active: 'success',
  retired: 'warning',
  archived: 'muted',
};

export default function PlansList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const pagination = usePagination({ initialPageSize: 25 });

  const plansQuery = useQuery({
    queryKey: queryKeys.plans.list({
      q: query || undefined,
      status: status === 'all' ? undefined : status,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    queryFn: () =>
      adminApi.listPlans({
        q: query || undefined,
        status: status === 'all' ? undefined : status,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Plans'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Plans', path: ROUTES.console.plans.overview },
      ]),
    );
  }, [dispatch]);

  const plans = plansQuery.data?.items ?? [];

  useEffect(() => {
    const total = plansQuery.data?.meta?.total;
    if (total !== undefined) pagination.setTotal(total);
  }, [plansQuery.data?.meta?.total, pagination.setTotal]);

  const columns = [
    {
      key: 'name',
      label: 'Plan',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          {row.description ? (
            <p className="truncate text-2xs text-muted-foreground">{row.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.price, row.currency ?? 'USD', { showSymbol: true })}
        </span>
      ),
    },
    {
      key: 'billingInterval',
      label: 'Interval',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.billingInterval ?? 'monthly'}
        </span>
      ),
    },
    {
      key: 'version',
      label: 'Version',
      render: (row) => (
        <Badge variant="muted">v{row.version ?? 1}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'muted'}>
          {row.status ?? 'draft'}
        </Badge>
      ),
    },
    {
      key: 'subscriberCount',
      label: 'Subscribers',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-foreground">{row.subscriberCount ?? 0}</span>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.updatedAt ? formatRelativeTime(row.updatedAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan changes are versioned. Updating a published plan never silently rewrites
            existing invoices or historical subscription terms.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to={ROUTES.console.plans.create}>
              <Plus className="h-4 w-4" /> Create plan
            </Link>
          </Button>
          <IconButton
            label="Refresh"
            onClick={() => plansQuery.refetch()}
            className="border border-border"
          >
            <RefreshCw
              className={plansQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            pagination.goToPage(1);
          }}
          placeholder="Search plans…"
          className="w-full max-w-md"
        />
        <SegmentedControl
          options={STATUS_FILTERS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            pagination.goToPage(1);
          }}
        />
      </div>

      <Card>
        <CardContent className="p-5 pt-5">
          <DataTable
            columns={columns}
            rows={plans}
            isLoading={plansQuery.isLoading}
            emptyTitle={query || status !== 'all' ? 'No matching plans' : 'No plans yet'}
            emptyDescription={
              query || status !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Create your first subscription plan.'
            }
            onRowClick={(row) => navigate(ROUTES.console.plans.details(row.id))}
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
        </CardContent>
      </Card>
    </div>
  );
}
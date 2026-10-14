import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Bell, Check, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { usePagination } from '../../hooks/usePagination.js';
import { alertsApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const SEVERITY_VARIANTS = {
  info: 'info',
  warning: 'warning',
  critical: 'destructive',
};

export default function AlertEvents() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('active');
  const pagination = usePagination({ initialPageSize: 50 });

  const eventsQuery = useQuery({
    queryKey: ['alert-events', { status, page: pagination.page }],
    queryFn: () =>
      alertsApi.events({
        status: status === 'all' ? undefined : status,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: ({ eventId, reason }) => alertsApi.acknowledge(eventId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-events'] });
      toast.success('Alert acknowledged');
    },
    onError: (err) =>
      toast.error('Failed to acknowledge', { description: getErrorMessage(err) }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ eventId, reason }) => alertsApi.resolve(eventId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-events'] });
      toast.success('Alert resolved');
    },
    onError: (err) =>
      toast.error('Failed to resolve', { description: getErrorMessage(err) }),
  });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Alert Events'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Alerts', path: '/alerts' },
        { label: 'Events', path: '/alerts/events' },
      ]),
    );
  }, [dispatch]);

  const events = eventsQuery.data?.items ?? [];

  if (eventsQuery.data?.meta?.total !== undefined) {
    pagination.setTotal(eventsQuery.data.meta.total);
  }

  const columns = [
    {
      key: 'triggeredAt',
      label: 'Triggered',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.triggeredAt ? formatDateTime(row.triggeredAt) : '—'}
        </span>
      ),
    },
    {
      key: 'ruleName',
      label: 'Rule',
      render: (row) => (
        <span className="text-sm text-foreground">{row.ruleName ?? '—'}</span>
      ),
    },
    {
      key: 'message',
      label: 'Message',
      render: (row) => (
        <span className="line-clamp-2 text-xs text-foreground">{row.message ?? '—'}</span>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row) => (
        <Badge variant={SEVERITY_VARIANTS[row.severity] ?? 'muted'}>
          {row.severity ?? 'warning'}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'resolved'
              ? 'success'
              : row.status === 'acknowledged'
                ? 'info'
                : 'warning'
          }
        >
          {row.status ?? 'active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === 'active' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                acknowledgeMutation.mutate({ eventId: row.id, reason: 'Reviewed' })
              }
              disabled={acknowledgeMutation.isPending}
            >
              <Check className="h-3.5 w-3.5" /> Ack
            </Button>
          ) : null}
          {row.status !== 'resolved' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resolveMutation.mutate({ eventId: row.id, reason: 'Resolved' })}
              disabled={resolveMutation.isPending}
            >
              Resolve
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Alert Events
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alerts triggered by configured rules. Acknowledging an alert does not remove the
            underlying restriction or incident.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => eventsQuery.refetch()}
          className="border border-border"
        >
          <RefreshCw
            className={eventsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />

      {eventsQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No alert events match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={events} />

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
      )}
    </div>
  );
}
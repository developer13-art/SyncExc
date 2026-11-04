import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { incidentsApi } from '../../api/index.js';
import { getErrorMessage } from '../../lib/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'identified', label: 'Identified' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'resolved', label: 'Resolved' },
];

const SEVERITY_VARIANTS = {
  sev1: 'destructive',
  sev2: 'warning',
  sev3: 'info',
  sev4: 'muted',
};

const INITIAL_FORM = {
  title: '',
  severity: 'sev3',
  summary: '',
  affectedServices: '',
};

export default function IncidentsList() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const incidentsQuery = useQuery({
    queryKey: ['admin-incidents', { status }],
    queryFn: () => incidentsApi.list({
      status: status === 'all' ? undefined : status,
      pageSize: 100,
    }),
  });

  const createMutation = useMutation({
    mutationFn: incidentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-incidents'] });
      toast.success('Incident created');
      setCreateOpen(false);
      setForm(INITIAL_FORM);
    },
    onError: (error) =>
      toast.error('Incident could not be created', { description: getErrorMessage(error) }),
  });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Incident management'));
    dispatch(adminUiActions.setBreadcrumbs([
      { label: 'Operations', path: '/overview' },
      { label: 'Incidents', path: '/incidents' },
    ]));
  }, [dispatch]);

  const incidents = incidentsQuery.data?.items ?? [];
  const columns = [
    {
      key: 'reference',
      label: 'Incident',
      render: (row) => (
        <div>
          <Link to={`/incidents/${row.id}`} className="font-mono text-xs text-primary hover:underline">
            {row.reference}
          </Link>
          <p className="mt-1 max-w-md truncate text-sm font-medium text-foreground">{row.title}</p>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row) => (
        <Badge variant={SEVERITY_VARIANTS[row.severity] ?? 'muted'}>{row.severity}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'resolved' ? 'success' : 'warning'}>
          {row.status?.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'affected_services',
      label: 'Affected services',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.affected_services?.join(', ') || 'Not specified'}
        </span>
      ),
    },
    {
      key: 'started_at',
      label: 'Started',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.started_at ? formatDateTime(row.started_at) : '—'}
        </span>
      ),
    },
  ];

  const handleCreate = (event) => {
    event.preventDefault();
    createMutation.mutate({
      title: form.title.trim(),
      severity: form.severity,
      summary: form.summary.trim(),
      affectedServices: form.affectedServices
        .split(',')
        .map((service) => service.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Incident management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track service incidents, severity, status updates, and resolution history.
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton
            label="Refresh incidents"
            onClick={() => incidentsQuery.refetch()}
            className="border border-border"
          >
            <RefreshCw className={incidentsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </IconButton>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create incident
          </Button>
        </div>
      </div>

      <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />

      {incidentsQuery.isLoading ? (
        <LoadingState label="Loading incidents" />
      ) : incidentsQuery.isError ? (
        <ErrorState
          title="Incidents unavailable"
          description={getErrorMessage(incidentsQuery.error)}
          onRetry={incidentsQuery.refetch}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <DataTable
              columns={columns}
              rows={incidents}
              emptyTitle="No incidents"
              emptyDescription="Incidents matching this status filter will appear here."
            />
          </CardContent>
        </Card>
      )}

      <Modal
        open={createOpen}
        onOpenChange={(open) => {
          if (!createMutation.isPending) setCreateOpen(open);
        }}
        title="Create platform incident"
        description="Creating an incident publishes its initial status and records an event in the incident timeline."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="create-incident" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create incident'}
            </Button>
          </>
        }
      >
        <form id="create-incident" onSubmit={handleCreate} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Title
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              minLength={5}
              maxLength={200}
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Severity
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.severity}
              onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}
            >
              <option value="sev1">SEV 1 — Critical</option>
              <option value="sev2">SEV 2 — High</option>
              <option value="sev3">SEV 3 — Moderate</option>
              <option value="sev4">SEV 4 — Low</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Summary
            <textarea
              className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.summary}
              onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              minLength={10}
              maxLength={2000}
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Affected services
            <Input
              value={form.affectedServices}
              onChange={(event) => setForm((current) => ({ ...current, affectedServices: event.target.value }))}
              placeholder="API, exchange connections"
            />
            <span className="text-xs font-normal text-muted-foreground">Separate service names with commas.</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}

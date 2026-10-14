import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Bell, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { alertsApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

const SEVERITY_VARIANTS = {
  info: 'info',
  warning: 'warning',
  critical: 'destructive',
};

export default function AlertRules() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    metric: '',
    threshold: '',
    severity: 'warning',
  });

  const rulesQuery = useQuery({
    queryKey: ['alert-rules'],
    queryFn: () => alertsApi.rules({ pageSize: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => alertsApi.createRule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      toast.success('Alert rule created');
      setCreateOpen(false);
      setForm({ name: '', metric: '', threshold: '', severity: 'warning' });
    },
    onError: (err) =>
      toast.error('Failed to create rule', { description: getErrorMessage(err) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId) => alertsApi.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
      toast.success('Alert rule deleted');
    },
    onError: (err) =>
      toast.error('Failed to delete rule', { description: getErrorMessage(err) }),
  });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Alert Rules'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Alerts', path: '/alerts' },
        { label: 'Rules', path: '/alerts/rules' },
      ]),
    );
  }, [dispatch]);

  const rules = rulesQuery.data?.items ?? [];

  const columns = [
    {
      key: 'name',
      label: 'Rule',
      render: (row) => (
        <span className="text-sm font-medium text-foreground">{row.name}</span>
      ),
    },
    {
      key: 'metric',
      label: 'Metric',
      render: (row) => (
        <span className="font-mono text-2xs text-muted-foreground">{row.metric}</span>
      ),
    },
    {
      key: 'threshold',
      label: 'Threshold',
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.operator ?? '>'} {row.threshold}
        </span>
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
        <Badge variant={row.status === 'active' ? 'success' : 'muted'}>
          {row.status ?? 'active'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => deleteMutation.mutate(row.id)}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Alert Rules
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational alert thresholds. Alerts must be actionable and deduplicated to prevent
            alert floods.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New rule
          </Button>
          <IconButton
            label="Refresh"
            onClick={() => rulesQuery.refetch()}
            className="border border-border"
          >
            <RefreshCw
              className={rulesQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </IconButton>
        </div>
      </div>

      {rulesQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No alert rules configured.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={rules} />
          </CardContent>
        </Card>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create alert rule"
        description="Define a threshold on a platform metric. Alerts fire when the threshold is breached."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name || !form.metric}
            >
              {createMutation.isPending ? 'Creating…' : 'Create rule'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Name" htmlFor="rule-name" required>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Metric" htmlFor="rule-metric" required>
            <Input
              id="rule-metric"
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
              placeholder="admin.api.error_rate"
            />
          </FormField>
          <FormField label="Threshold" htmlFor="rule-threshold" required>
            <Input
              id="rule-threshold"
              type="text"
              inputMode="decimal"
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            />
          </FormField>
          <FormField label="Severity" htmlFor="rule-severity" required>
            <select
              id="rule-severity"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
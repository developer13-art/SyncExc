import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Headphones, Plus, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { supportApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

export default function Queues() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: '' });

  const queuesQuery = useQuery({
    queryKey: ['support', 'queues'],
    queryFn: () => supportApi.queues(),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => supportApi.createQueue(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'queues'] });
      toast.success('Queue created');
      setCreateOpen(false);
      setForm({ name: '', description: '', category: '' });
    },
    onError: (err) =>
      toast.error('Failed to create queue', { description: getErrorMessage(err) }),
  });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Support Queues'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Support', path: '/support' },
        { label: 'Queues', path: '/support/queues' },
      ]),
    );
  }, [dispatch]);

  const queues = queuesQuery.data ?? [];

  const columns = [
    {
      key: 'name',
      label: 'Queue',
      render: (row) => (
        <span className="text-sm font-medium text-foreground">{row.name}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <Badge variant="muted">{row.category?.replace(/_/g, ' ') ?? 'general'}</Badge>
      ),
    },
    {
      key: 'memberCount',
      label: 'Members',
      align: 'right',
      render: (row) => row.memberCount ?? 0,
    },
    {
      key: 'openTickets',
      label: 'Open tickets',
      align: 'right',
      render: (row) => row.openTickets ?? 0,
    },
    {
      key: 'targetResponseMinutes',
      label: 'Target response',
      align: 'right',
      render: (row) =>
        row.targetResponseMinutes !== undefined ? `${row.targetResponseMinutes} min` : '—',
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
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Support Queues
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define queues, routing rules, and response targets. Restricted queues remain
            isolated from general access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New queue
          </Button>
          <IconButton
            label="Refresh"
            onClick={() => queuesQuery.refetch()}
            className="border border-border"
          >
            <RefreshCw
              className={queuesQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </IconButton>
        </div>
      </div>

      {queuesQuery.isLoading ? (
        <Card>
          <CardContent className="p-5">
            <div className="h-64 animate-pulse rounded-md bg-muted" />
          </CardContent>
        </Card>
      ) : queues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Headphones className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No queues configured yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <DataTable columns={columns} rows={queues} />
          </CardContent>
        </Card>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create queue"
        description="Queues route incoming tickets based on category and required expertise."
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
              disabled={createMutation.isPending || !form.name.trim()}
            >
              {createMutation.isPending ? 'Creating…' : 'Create queue'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Name" htmlFor="queue-name" required>
            <Input
              id="queue-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Description" htmlFor="queue-description">
            <Textarea
              id="queue-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>
          <FormField label="Category" htmlFor="queue-category">
            <Input
              id="queue-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="account_access"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
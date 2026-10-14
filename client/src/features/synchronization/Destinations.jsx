import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { useSyncGroup } from '../../hooks/useSync.js';
import { useConnections } from '../../hooks/useConnections.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { synchronizationApi } from '../../api/index.js';
import { cn } from '../../lib/utils/cn.util.js';

export function Destinations({ groupId }) {
  const toast = useToast();
  const groupQuery = useSyncGroup(groupId);
  const connectionsQuery = useConnections({ status: 'active' });

  const [addOpen, setAddOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const destinations = groupQuery.destinations ?? [];

  const availableAccounts = (connectionsQuery.data?.items ?? []).flatMap((c) =>
    (c.accounts ?? []).map((a) => ({
      id: a.id,
      label: a.label ?? a.id,
      exchangeName: c.exchangeName,
      connectionId: c.id,
    })),
  );

  const handleAdd = async () => {
    if (!selectedAccountId) {
      return;
    }
    setSubmitting(true);
    try {
      const account = availableAccounts.find((a) => a.id === selectedAccountId);
      await groupQuery.addDestination({
        accountId: selectedAccountId,
        connectionId: account?.connectionId,
      });
      toast.success('Destination added');
      setAddOpen(false);
      setSelectedAccountId('');
    } catch (error) {
      toast.error('Failed to add destination', { description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (destinationId) => {
    try {
      await groupQuery.removeDestination(destinationId);
      toast.success('Destination removed');
    } catch (error) {
      toast.error('Failed to remove destination', { description: getErrorMessage(error) });
    }
  };

  const columns = [
    {
      key: 'label',
      label: 'Destination',
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.label ?? row.accountId}</p>
          <p className="text-2xs uppercase tracking-wide text-muted-foreground">
            {row.exchangeName}
          </p>
        </div>
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
      key: 'sizing',
      label: 'Sizing',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.sizingPolicy?.type?.replace(/_/g, ' ') ?? 'inherited'}
        </span>
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
          onClick={() => handleRemove(row.id)}
        >
          Remove
        </Button>
      ),
    },
  ];

  if (groupQuery.isLoading) {
    return <LoadingState label="Loading destinations" />;
  }

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Destination accounts</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Each destination has its own authorization and risk evaluation.
            </p>
          </div>
          <div className="flex gap-2">
            <IconButton
              label="Refresh"
              onClick={() => groupQuery.refetch?.()}
              className="border border-border"
            >
              <RefreshCw className="h-4 w-4" />
            </IconButton>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        {destinations.length === 0 ? (
          <EmptyState
            title="No destinations configured"
            description="Add an authorized destination account to receive mirrored operations."
            size="sm"
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <DataTable columns={columns} rows={destinations} />
        )}
      </CardContent>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add destination account"
        description="Choose an authorized account. It will be validated for capability before dispatch."
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!selectedAccountId || submitting}>
              {submitting ? 'Adding…' : 'Add destination'}
            </Button>
          </>
        }
      >
        <FormField label="Account" htmlFor="destination-account" required>
          <select
            id="destination-account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select account…</option>
            {availableAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.exchangeName} · {a.label}
              </option>
            ))}
          </select>
        </FormField>
      </Modal>
    </Card>
  );
}
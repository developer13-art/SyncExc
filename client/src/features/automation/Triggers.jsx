import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { TriggerForm } from './components/TriggerForm.jsx';
import { automationApi } from '../../api/index.js';
import { useWorkflow } from '../../hooks/useAutomation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export function Triggers({ workflowId }) {
  const toast = useToast();
  const workflowQuery = useWorkflow(workflowId);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (workflowQuery.isLoading) {
    return <LoadingState label="Loading triggers" />;
  }

  const triggers = workflowQuery.triggers ?? [];

  const handleAdd = async (values) => {
    setSubmitting(true);
    try {
      await automationApi.createTrigger(workflowId, values);
      toast.success('Trigger added');
      setAddOpen(false);
      await workflowQuery.refetch?.();
    } catch (err) {
      toast.error('Failed to add trigger', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handlePause = async (trigger) => {
    try {
      await automationApi.pauseTrigger(trigger.id, { reason: 'Manual pause' });
      toast.success('Trigger paused');
      await workflowQuery.refetch?.();
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    }
  };

  const handleDelete = async (trigger) => {
    try {
      await automationApi.updateTrigger(trigger.id, { deleted: true });
      toast.success('Trigger removed');
      await workflowQuery.refetch?.();
    } catch (err) {
      toast.error('Delete failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Triggers</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add trigger
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {triggers.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No triggers configured. Add a trigger to define what starts this workflow.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {triggers.map((trigger) => (
              <li
                key={trigger.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{trigger.name}</p>
                    <Badge variant="info">{trigger.type?.replace(/_/g, ' ')}</Badge>
                    {trigger.status === 'paused' ? (
                      <Badge variant="warning">Paused</Badge>
                    ) : null}
                  </div>
                  {trigger.filter ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Filter: {trigger.filter}
                    </p>
                  ) : null}
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {trigger.lastFiredAt
                      ? `Last fired ${formatRelativeTime(trigger.lastFiredAt)}`
                      : 'Not yet fired'}
                    {trigger.dedupWindowSeconds
                      ? ` · dedup ${trigger.dedupWindowSeconds}s`
                      : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  {trigger.status !== 'paused' ? (
                    <Button variant="ghost" size="sm" onClick={() => handlePause(trigger)}>
                      Pause
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(trigger)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add trigger"
        description="Define the event that starts this workflow."
      >
        <TriggerForm
          onSubmit={handleAdd}
          onCancel={() => setAddOpen(false)}
          isSubmitting={submitting}
        />
      </Modal>
    </Card>
  );
}
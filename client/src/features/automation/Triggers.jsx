import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { TriggerForm } from './components/TriggerForm.jsx';
import { automationApi } from '../../api/index.js';
import { useWorkflow } from '../../hooks/useAutomation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export function buildTriggerRegistrationPayload(versionId, values) {
  const filter = values.filter.trim() ? JSON.parse(values.filter) : undefined;

  return {
    versionId,
    triggers: [{
      type: values.type,
      config: {
        name: values.name.trim(),
        ...(filter ? { filter } : {}),
      },
    }],
  };
}

export function Triggers({ workflowId }) {
  const toast = useToast();
  const workflowQuery = useWorkflow(workflowId);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (
    workflowQuery.isLoading
    || workflowQuery.versionsLoading
    || workflowQuery.triggersLoading
  ) {
    return <LoadingState label="Loading triggers" />;
  }

  if (workflowQuery.error || workflowQuery.versionsError) {
    const error = workflowQuery.error ?? workflowQuery.versionsError;
    return (
      <ErrorState
        title="Unable to load workflow"
        description={getErrorMessage(error)}
        onRetry={() => Promise.all([
          workflowQuery.refetch?.(),
          workflowQuery.refetchVersions?.(),
        ])}
      />
    );
  }

  if (workflowQuery.triggersError) {
    return (
      <ErrorState
        title="Unable to load triggers"
        description={getErrorMessage(workflowQuery.triggersError)}
        onRetry={workflowQuery.refetchTriggers}
      />
    );
  }

  const triggers = workflowQuery.triggers ?? [];
  const currentVersion = workflowQuery.versions.find(
    (version) => Number(version.version) === Number(workflowQuery.workflow?.currentVersion),
  ) ?? workflowQuery.versions[0];

  const handleAdd = async (values) => {
    if (!currentVersion?.id) {
      toast.error('Unable to add trigger', {
        description: 'This workflow has no version yet. Save the workflow before adding a trigger.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await automationApi.createTrigger(
        workflowId,
        buildTriggerRegistrationPayload(currentVersion.id, values),
      );
      toast.success('Trigger added');
      setAddOpen(false);
      await workflowQuery.refetchTriggers?.();
    } catch (err) {
      toast.error('Failed to add trigger', { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
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
                    <p className="text-sm font-medium text-foreground">
                      {trigger.name
                        ?? trigger.config?.name
                        ?? trigger.type?.replace(/_/g, ' ')
                        ?? trigger.trigger_type?.replace(/_/g, ' ')}
                    </p>
                    <Badge variant="info">{(trigger.type ?? trigger.trigger_type)?.replace(/_/g, ' ')}</Badge>
                    {trigger.status === 'paused' || trigger.enabled === false ? (
                      <Badge variant="warning">Paused</Badge>
                    ) : null}
                  </div>
                  {trigger.filter || trigger.config?.filter ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Filter: {JSON.stringify(trigger.filter ?? trigger.config.filter)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {trigger.lastFiredAt ?? trigger.last_fired_at
                      ? `Last fired ${formatRelativeTime(trigger.lastFiredAt ?? trigger.last_fired_at)}`
                      : 'Not yet fired'}
                  </p>
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
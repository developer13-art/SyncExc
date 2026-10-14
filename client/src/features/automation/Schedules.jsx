import { useState } from 'react';
import { Pause, Play, Plus, Trash2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ScheduleForm } from './components/ScheduleForm.jsx';
import { automationApi } from '../../api/index.js';
import { useWorkflow } from '../../hooks/useAutomation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function Schedules({ workflowId }) {
  const toast = useToast();
  const workflowQuery = useWorkflow(workflowId);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (workflowQuery.isLoading) {
    return <LoadingState label="Loading schedules" />;
  }

  const schedules = workflowQuery.schedules ?? [];

  const handleAdd = async (values) => {
    setSubmitting(true);
    try {
      await automationApi.createSchedule(workflowId, values);
      toast.success('Schedule created');
      setAddOpen(false);
      await workflowQuery.refetch?.();
    } catch (err) {
      toast.error('Failed to create schedule', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handlePause = async (schedule) => {
    try {
      await automationApi.pauseSchedule(schedule.id);
      toast.success('Schedule paused');
      await workflowQuery.refetch?.();
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    }
  };

  const handleResume = async (schedule) => {
    try {
      await automationApi.resumeSchedule(schedule.id);
      toast.success('Schedule resumed');
      await workflowQuery.refetch?.();
    } catch (err) {
      toast.error('Resume failed', { description: getErrorMessage(err) });
    }
  };

  const handleDelete = async (schedule) => {
    try {
      await automationApi.updateSchedule(schedule.id, { deleted: true });
      toast.success('Schedule removed');
      await workflowQuery.refetch?.();
    } catch (err) {
      toast.error('Delete failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Schedules</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {schedules.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No schedules configured. Add a schedule to trigger this workflow on a time-based
            pattern.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground capitalize">
                      {schedule.recurrence}
                    </p>
                    <Badge variant={schedule.status === 'active' ? 'success' : 'warning'}>
                      {schedule.status ?? 'active'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {schedule.time ?? ''} · {schedule.timezone ?? 'UTC'}
                    {schedule.endDate ? ` · Until ${schedule.endDate}` : ''}
                  </p>
                  {schedule.nextRunAt ? (
                    <p className="mt-1 text-2xs text-muted-foreground">
                      Next run {formatDateTime(schedule.nextRunAt)}
                    </p>
                  ) : null}
                  {schedule.missedRunPolicy ? (
                    <p className="mt-1 text-2xs text-muted-foreground">
                      Missed run policy: {schedule.missedRunPolicy.replace(/_/g, ' ')}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  {schedule.status === 'active' ? (
                    <Button variant="ghost" size="sm" onClick={() => handlePause(schedule)}>
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleResume(schedule)}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(schedule)}
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
        title="Add schedule"
        description="Define when this workflow should run automatically."
      >
        <ScheduleForm
          onSubmit={handleAdd}
          onCancel={() => setAddOpen(false)}
          isSubmitting={submitting}
        />
      </Modal>
    </Card>
  );
}
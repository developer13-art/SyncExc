import { useState } from 'react';
import { Play } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { automationApi } from '../../api/index.js';
import { useWorkflow, useWorkflows } from '../../hooks/useAutomation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export function TestRuns({ workflowId }) {
  const toast = useToast();
  const workflowQuery = useWorkflow(workflowId);
  const [event, setEvent] = useState('');
  const [running, setRunning] = useState(false);

  if (workflowQuery.isLoading) {
    return <LoadingState label="Loading test runs" />;
  }

  const testRuns = workflowQuery.testRuns ?? [];

  const handleRun = async () => {
    setRunning(true);
    try {
      let parsed;
      try {
        parsed = event ? JSON.parse(event) : {};
      } catch {
        toast.error('Invalid JSON in test event');
        return;
      }
      await automationApi.createTestRun(workflowId, { sampleEvent: parsed });
      toast.success('Test run queued', {
        description: 'Results will appear below.',
      });
      setEvent('');
      await workflowQuery.refetch?.();
    } catch (err) {
      toast.error('Test run failed', { description: getErrorMessage(err) });
    } finally {
      setRunning(false);
    }
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Run',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'succeeded'
              ? 'success'
              : row.status === 'failed'
                ? 'destructive'
                : 'warning'
          }
        >
          {row.status ?? 'running'}
        </Badge>
      ),
    },
    {
      key: 'nodesExecuted',
      label: 'Nodes executed',
      align: 'right',
      render: (row) => row.nodesExecuted ?? '—',
    },
    {
      key: 'warnings',
      label: 'Warnings',
      align: 'right',
      render: (row) => (row.warnings?.length > 0 ? row.warnings.length : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Test runs execute in a simulation context. They never invoke live trading actions,
          never reach live exchange endpoints, and are clearly labeled as test results.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger a test run</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="test-event">Sample event (JSON, optional)</Label>
            <Textarea
              id="test-event"
              rows={6}
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder='{"instrument": "BTCUSDT", "direction": "long", "entry": 60000}'
              className="font-mono text-xs"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleRun} disabled={running}>
              <Play className="h-3.5 w-3.5" />
              {running ? 'Running…' : 'Run test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test history</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <DataTable
            columns={columns}
            rows={testRuns}
            emptyTitle="No test runs yet"
            emptyDescription="Run your first test above."
          />
        </CardContent>
      </Card>
    </div>
  );
}
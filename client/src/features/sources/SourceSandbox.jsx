import { useState } from 'react';
import { Play } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { useQuery } from '@tanstack/react-query';
import { sourcesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function SourceSandbox({ sourceId }) {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [running, setRunning] = useState(false);

  const testsQuery = useQuery({
    queryKey: queryKeys.sources.sandboxTests(sourceId, {}),
    queryFn: () => sourcesApi.listSandboxTests(sourceId),
    enabled: Boolean(sourceId),
  });

  const tests = testsQuery.data?.items ?? [];

  const handleRun = async () => {
    if (!message.trim()) {
      toast.error('Enter a message to test');
      return;
    }
    setRunning(true);
    try {
      await sourcesApi.createSandboxTest(sourceId, { content: message });
      toast.success('Sandbox test queued', {
        description: 'Results will appear below.',
      });
      setMessage('');
      await testsQuery.refetch();
    } catch (err) {
      toast.error('Sandbox test failed', { description: getErrorMessage(err) });
    } finally {
      setRunning(false);
    }
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatDateTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'result',
      label: 'Result',
      render: (row) => (
        <Badge
          variant={
            row.result === 'success'
              ? 'success'
              : row.result === 'failed'
                ? 'destructive'
                : 'warning'
          }
        >
          {row.result ?? 'pending'}
        </Badge>
      ),
    },
    {
      key: 'parsedFields',
      label: 'Parsed fields',
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.parsedFields ?? row.fieldsFound ?? '—'}
        </span>
      ),
    },
    {
      key: 'issues',
      label: 'Issues',
      render: (row) =>
        row.issues?.length > 0 ? (
          <span className="text-xs text-warning">{row.issues.length}</span>
        ) : (
          <span className="text-xs text-muted-foreground">none</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Sandbox tests run in an isolated context. They never submit live orders, never
          modify live source configuration, and never affect production data.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test a message</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sandbox-message">Sample message</Label>
            <Textarea
              id="sandbox-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Paste a representative message from this source"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleRun} disabled={running || !message.trim()}>
              <Play className="h-3.5 w-3.5" />
              {running ? 'Running…' : 'Run sandbox test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test history</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {testsQuery.isLoading ? (
            <LoadingState label="Loading test history" />
          ) : (
            <DataTable
              columns={columns}
              rows={tests}
              emptyTitle="No sandbox tests yet"
              emptyDescription="Run your first test above."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import { useParams } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useWorkflow, useWorkflows } from '../../hooks/useAutomation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function WorkflowVersions({ workflowId }) {
  const toast = useToast();
  const workflowQuery = useWorkflow(workflowId);
  const { workflows: _workflows } = useWorkflows();
  const versions = workflowQuery.versions ?? [];

  if (workflowQuery.isLoading) {
    return <LoadingState label="Loading versions" />;
  }

  const handleRollback = async (version) => {
    try {
      await workflowQuery.rollbackWorkflow?.({
        workflowId,
        versionId: version.id,
      });
      toast.success(`Rolled back to version ${version.version}`);
    } catch (err) {
      toast.error('Rollback failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {versions.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No published versions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      Version {version.version}
                    </p>
                    <Badge variant={version.status === 'active' ? 'success' : 'muted'}>
                      {version.status ?? 'published'}
                    </Badge>
                  </div>
                  {version.changeSummary ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {version.changeSummary}
                    </p>
                  ) : null}
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {version.createdAt ? formatDateTime(version.createdAt) : ''}
                    {version.createdBy ? ` · ${version.createdBy}` : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRollback(version)}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Rollback
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
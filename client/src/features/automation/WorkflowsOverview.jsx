import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, Workflow } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { RunStatusBadge } from '../../components/domain/workflow/RunStatusBadge.jsx';
import { useWorkflows } from '../../hooks/useAutomation.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
];

export default function WorkflowsOverview() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Automation Studio'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Automation', path: ROUTES.app.automation.overview },
      ]),
    );
  }, [dispatch]);

  const workflowsQuery = useWorkflows({
    status: status === 'all' ? undefined : status,
    q: query || undefined,
  });

  const workflows = workflowsQuery.workflows ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Automation Studio
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visual workflows built on triggers, conditions, and actions. Workflows orchestrate —
            they do not authorize trading. Every consequential action passes downstream
            safeguards.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.automation.templates}>Templates</Link>
          </Button>
          <Button asChild>
            <Link to={ROUTES.app.automation.create}>
              <Plus className="h-4 w-4" /> New workflow
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search workflows…"
            className="w-full max-w-xs"
          />
          <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
        </div>
        <IconButton
          label="Refresh"
          onClick={() => workflowsQuery.refetch?.()}
          className="border border-border"
        >
          <Workflow className={workflowsQuery.isLoading ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
        </IconButton>
      </div>

      {workflowsQuery.isLoading ? (
        <LoadingState label="Loading workflows" />
      ) : workflowsQuery.isError ? (
        <ErrorState
          title="Unable to load workflows"
          description="We could not fetch your workflows."
          onRetry={workflowsQuery.refetch}
        />
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={query || status !== 'all' ? 'No matching workflows' : 'No workflows yet'}
          description={
            query || status !== 'all'
              ? 'Try adjusting your filters.'
              : 'Create a workflow to orchestrate triggers, conditions, and actions across SyncExc services.'
          }
          action={
            !query && status === 'all' ? (
              <Button asChild>
                <Link to={ROUTES.app.automation.create}>Create workflow</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({ workflow }) {
  const linkTo = ROUTES.app.automation.workflow(workflow.id);
  const isActive = workflow.status === 'active';

  return (
    <Card className="overflow-hidden transition hover:border-primary/40">
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{workflow.name}</p>
            {workflow.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {workflow.description}
              </p>
            ) : null}
          </div>
          <Badge variant={isActive ? 'success' : workflow.status === 'paused' ? 'warning' : 'muted'}>
            {workflow.status ?? 'draft'}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {workflow.triggerCount !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {workflow.triggerCount} trigger{workflow.triggerCount !== 1 ? 's' : ''}
            </span>
          ) : null}
          {workflow.nodeCount !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              {workflow.nodeCount} node{workflow.nodeCount !== 1 ? 's' : ''}
            </span>
          ) : null}
          {workflow.version !== undefined ? (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground">
              v{workflow.version}
            </span>
          ) : null}
        </div>

        {workflow.lastRunAt ? (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-2xs text-muted-foreground">
            <span>Last run {formatRelativeTime(workflow.lastRunAt)}</span>
            {workflow.lastRunStatus ? <RunStatusBadge status={workflow.lastRunStatus} /> : null}
          </div>
        ) : null}
      </Link>
    </Card>
  );
}
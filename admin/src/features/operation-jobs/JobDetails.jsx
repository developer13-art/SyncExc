import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { operationJobsApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  queued: 'muted',
  validating: 'warning',
  running: 'info',
  waiting_for_approval: 'warning',
  partially_succeeded: 'warning',
  succeeded: 'success',
  failed: 'destructive',
  cancellation_requested: 'muted',
  cancelled: 'muted',
  reconciliation_required: 'destructive',
};

export default function JobDetails() {
  const { jobId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const jobQuery = useQuery({
    queryKey: ['operation-job', jobId],
    queryFn: () => operationJobsApi.get(jobId),
    enabled: Boolean(jobId),
    refetchInterval: (data) => {
      const status = data?.state?.data?.status;
      if (['succeeded', 'failed', 'cancelled', 'partially_succeeded'].includes(status)) {
        return false;
      }
      return 5_000;
    },
  });

  const eventsQuery = useQuery({
    queryKey: ['operation-job', jobId, 'events'],
    queryFn: () => operationJobsApi.events(jobId, { pageSize: 100 }),
    enabled: Boolean(jobId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => operationJobsApi.cancel(jobId, { reason: 'Admin requested cancellation' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-job', jobId] });
      toast.success('Cancellation requested');
    },
    onError: (err) =>
      toast.error('Cancellation failed', { description: getErrorMessage(err) }),
  });

  useEffect(() => {
    if (jobQuery.data) {
      dispatch(adminUiActions.setPageTitle(`Operation · ${jobQuery.data.operationType}`));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Operation Jobs', path: '/operation-jobs' },
          {
            label: jobQuery.data.id?.slice(0, 12) ?? 'Job',
            path: `/operation-jobs/${jobId}`,
          },
        ]),
      );
    }
  }, [jobQuery.data, dispatch, jobId]);

  if (jobQuery.isLoading) {
    return <LoadingState label="Loading operation job" />;
  }

  if (jobQuery.error || !jobQuery.data) {
    return (
      <ErrorState
        title="Unable to load operation job"
        description="This operation job could not be retrieved."
        onRetry={jobQuery.refetch}
      />
    );
  }

  const job = jobQuery.data;
  const events = eventsQuery.data?.items ?? [];

  const canCancel = ['queued', 'validating', 'running', 'waiting_for_approval'].includes(
    job.status,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/operation-jobs">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {job.operationType?.replace(/_/g, ' ') ?? 'Operation job'}
            </h1>
            <Badge variant={STATUS_VARIANTS[job.status] ?? 'muted'}>
              {job.status?.replace(/_/g, ' ') ?? 'unknown'}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{job.id}</p>
        </div>
        {canCancel ? (
          <Button
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            <XCircle className="h-4 w-4" />
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel job'}
          </Button>
        ) : null}
      </div>

      {job.progress !== undefined ? (
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ProgressBar value={job.progress * 100} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{(job.progress * 100).toFixed(0)}% complete</span>
              <span>
                {job.processedItems ?? 0} / {job.totalItems ?? '—'} items processed
              </span>
            </div>
            {job.successCount !== undefined || job.failedCount !== undefined ? (
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="text-success">
                  {job.successCount ?? 0} succeeded
                </span>
                <span className="text-warning">
                  {job.skippedCount ?? 0} skipped
                </span>
                <span className="text-destructive">
                  {job.failedCount ?? 0} failed
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Requested by" value={job.requestingAdmin ?? '—'} />
          <Field label="Authorization scope" value={job.authorizationScope ?? '—'} />
          <Field label="Retry count" value={job.retryCount ?? 0} />
          <Field
            label="Started"
            value={job.startedAt ? formatDateTime(job.startedAt) : '—'}
          />
          <Field
            label="Completed"
            value={job.completedAt ? formatDateTime(job.completedAt) : '—'}
          />
          <Field label="Cancellation" value={job.canCancel ? 'supported' : 'not supported'} />
          <Field label="Rollback" value={job.canRollback ? 'supported' : 'not supported'} />
          <Field
            label="Last error"
            value={job.lastError ?? '—'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No job events recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((event, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {event.description ?? event.type}
                    </p>
                    {event.detail ? (
                      <p className="mt-0.5 text-2xs text-muted-foreground">{event.detail}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {event.occurredAt ? formatDateTime(event.occurredAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          mono
            ? 'mt-0.5 truncate font-mono text-2xs text-foreground'
            : 'mt-0.5 text-sm font-medium text-foreground'
        }
      >
        {value}
      </p>
    </div>
  );
}
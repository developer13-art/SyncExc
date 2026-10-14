import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { CandidateCard } from './components/CandidateCard.jsx';
import { ReviewDialog } from './components/ReviewDialog.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sourcesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { useState } from 'react';

export default function DiscoveryJob() {
  const { jobId } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [reviewState, setReviewState] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const jobQuery = useQuery({
    queryKey: queryKeys.sources.discoveryJob(jobId),
    queryFn: () => sourcesApi.getDiscoveryJob(jobId),
    enabled: Boolean(jobId),
    refetchInterval: 10_000,
  });

  const candidatesQuery = useQuery({
    queryKey: [...queryKeys.sources.candidates({}), { jobId }],
    queryFn: () => sourcesApi.listCandidates({ jobId }),
    enabled: Boolean(jobId),
    refetchInterval: 15_000,
  });

  if (jobQuery.isLoading) {
    return <LoadingState label="Loading discovery job" />;
  }

  if (jobQuery.error || !jobQuery.data) {
    return (
      <ErrorState
        title="Unable to load discovery job"
        description="This job could not be retrieved."
        onRetry={jobQuery.refetch}
      />
    );
  }

  const job = jobQuery.data;
  const candidates = candidatesQuery.data?.items ?? [];

  const handleDecision = async ({ decision, reason }) => {
    if (!reviewState) {
      return;
    }
    setSubmitting(true);
    try {
      await sourcesApi.decideSourceCandidate(reviewState.candidate.id, {
        decision,
        reason,
      });
      toast.success(
        decision === 'approve' ? 'Candidate approved' : 'Candidate rejected',
      );
      setReviewState(null);
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    } catch (err) {
      toast.error('Decision failed', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.sources.discovery}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Discovery job
            </h1>
            <Badge
              variant={
                job.status === 'completed'
                  ? 'success'
                  : job.status === 'failed'
                    ? 'destructive'
                    : 'warning'
              }
            >
              {job.status ?? 'running'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Started {job.createdAt ? formatDateTime(job.createdAt) : '—'} ·{' '}
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => {
            jobQuery.refetch();
            candidatesQuery.refetch();
          }}
          className="border border-border"
        >
          <RefreshCw
            className={jobQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(job.platforms ?? []).map((p) => (
            <Badge key={p} variant="muted">
              {p}
            </Badge>
          ))}
          {(job.languages ?? []).map((l) => (
            <Badge key={l} variant="info">
              {l}
            </Badge>
          ))}
          {(job.styles ?? []).map((s) => (
            <Badge key={s} variant="muted">
              {s}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {candidatesQuery.isLoading ? (
            <LoadingState label="Loading candidates" />
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No candidates yet. Results will appear as the job progresses.
            </p>
          ) : (
            candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onApprove={(c) => setReviewState({ candidate: c, decision: 'approve' })}
                onReject={(c) => setReviewState({ candidate: c, decision: 'reject' })}
                onInspect={(c) => setReviewState({ candidate: c, decision: 'approve' })}
              />
            ))
          )}
        </CardContent>
      </Card>

      <ReviewDialog
        open={Boolean(reviewState)}
        onOpenChange={(open) => !open && setReviewState(null)}
        decision={reviewState?.decision}
        candidate={reviewState?.candidate}
        onSubmit={handleDecision}
        isSubmitting={submitting}
      />
    </div>
  );
}
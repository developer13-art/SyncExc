import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { JsonViewer } from '../../components/ui/JsonViewer.jsx';
import { ReviewDecisionForm } from './ReviewDecisionForm.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { sourceDiscoveryApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const STATUS_VARIANTS = {
  pending_review: 'warning',
  additional_information_required: 'warning',
  approved_for_validation: 'info',
  validation_in_progress: 'info',
  approved: 'success',
  rejected: 'destructive',
  suspended: 'destructive',
};

export default function CandidateDetails() {
  const { candidateId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const candidateQuery = useQuery({
    queryKey: ['source-discovery', 'candidate', candidateId],
    queryFn: () => sourceDiscoveryApi.getCandidate(candidateId),
    enabled: Boolean(candidateId),
  });

  const decideMutation = useMutation({
    mutationFn: (payload) => sourceDiscoveryApi.decide(candidateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['source-discovery', 'candidate', candidateId],
      });
      queryClient.invalidateQueries({ queryKey: ['source-discovery', 'candidates'] });
      toast.success('Review decision recorded');
    },
    onError: (err) => {
      toast.error('Decision failed', { description: getErrorMessage(err) });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload) => sourceDiscoveryApi.register(candidateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['source-discovery', 'candidate', candidateId],
      });
      toast.success('Candidate registered as a source');
    },
    onError: (err) => {
      toast.error('Registration failed', { description: getErrorMessage(err) });
    },
  });

  useEffect(() => {
    if (candidateQuery.data) {
      dispatch(
        adminUiActions.setPageTitle(
          candidateQuery.data.name ?? candidateQuery.data.proposedName ?? 'Candidate',
        ),
      );
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Source Discovery', path: '/source-discovery' },
          {
            label: candidateQuery.data.name ?? 'Candidate',
            path: `/source-discovery/${candidateId}`,
          },
        ]),
      );
    }
  }, [candidateQuery.data, dispatch, candidateId]);

  if (candidateQuery.isLoading) {
    return <LoadingState label="Loading candidate" />;
  }

  if (candidateQuery.error || !candidateQuery.data) {
    return (
      <ErrorState
        title="Unable to load candidate"
        description="This source candidate could not be retrieved."
        onRetry={candidateQuery.refetch}
      />
    );
  }

  const candidate = candidateQuery.data;
  const canDecide =
    candidate.status === 'pending_review' ||
    candidate.status === 'additional_information_required';
  const canRegister = candidate.status === 'approved_for_validation';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/source-discovery">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {candidate.name ?? candidate.proposedName}
            </h1>
            <Badge variant={STATUS_VARIANTS[candidate.status] ?? 'muted'}>
              {candidate.status?.replace(/_/g, ' ') ?? 'unknown'}
            </Badge>
            {candidate.duplicateOf ? (
              <Badge variant="warning">Possible duplicate</Badge>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">
            {candidate.id}
          </p>
        </div>

        {canRegister ? (
          <Button
            onClick={() => registerMutation.mutate({})}
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? 'Registering…' : 'Register as source'}
          </Button>
        ) : null}
      </div>

      {candidate.duplicateOf ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-3 p-4 pt-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              This candidate was flagged as a possible duplicate of{' '}
              <Link
                to={`/source-discovery/${candidate.duplicateOf}`}
                className="text-primary hover:underline"
              >
                {candidate.duplicateOf}
              </Link>
              . Consider linking rather than creating a duplicate source.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Candidate details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Platform" value={candidate.platform ?? '—'} />
          <Field label="Category" value={candidate.category ?? '—'} />
          <Field
            label="Claimed URL"
            value={candidate.claimedUrl ?? '—'}
            mono
          />
          <Field
            label="Discovery job"
            value={candidate.discoveryJobId?.slice(0, 12) ?? '—'}
            mono
          />
          <Field
            label="Discovered"
            value={candidate.discoveredAt ? formatDateTime(candidate.discoveredAt) : '—'}
          />
          <Field
            label="AI confidence"
            value={
              candidate.confidence !== undefined
                ? `${(candidate.confidence * 100).toFixed(0)}%`
                : '—'
            }
          />
          <Field label="Reviewer" value={candidate.reviewerAssignedTo ?? 'unassigned'} />
          <Field
            label="Last updated"
            value={candidate.updatedAt ? formatDateTime(candidate.updatedAt) : '—'}
          />
        </CardContent>
      </Card>

      {candidate.description ? (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {candidate.description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {candidate.evidence?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {candidate.evidence.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{item.label ?? item.description}</p>
                    {item.provenance ? (
                      <Badge variant="muted" size="sm" className="mt-1">
                        {item.provenance}
                      </Badge>
                    ) : null}
                  </div>
                  {item.confidence !== undefined ? (
                    <span className="shrink-0 text-2xs text-muted-foreground">
                      {(item.confidence * 100).toFixed(0)}%
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {candidate.aiAnalysis ? (
        <Card>
          <CardHeader>
            <CardTitle>AI analysis (candidate ranking, not authorization)</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonViewer data={candidate.aiAnalysis} />
          </CardContent>
        </Card>
      ) : null}

      {candidate.reviewHistory?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Review history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {candidate.reviewHistory.map((entry, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {entry.decision?.replace(/_/g, ' ') ?? entry.action}
                    </p>
                    {entry.reason ? (
                      <p className="mt-0.5 text-2xs text-muted-foreground">{entry.reason}</p>
                    ) : null}
                    {entry.actorName ? (
                      <p className="mt-0.5 text-2xs text-muted-foreground">
                        by {entry.actorName}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {entry.occurredAt ? formatDateTime(entry.occurredAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {canDecide ? (
        <ReviewDecisionForm
          candidate={candidate}
          onSubmit={(payload) => decideMutation.mutate(payload)}
          isSubmitting={decideMutation.isPending}
        />
      ) : null}
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
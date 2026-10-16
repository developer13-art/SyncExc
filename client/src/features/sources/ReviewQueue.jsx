import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { RefreshCw, ClipboardList } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { CandidateCard } from './components/CandidateCard.jsx';
import { ReviewDialog } from './components/ReviewDialog.jsx';
import { useSourceCandidates } from '../../hooks/useSources.js';
import { sourcesApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function ReviewQueue() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [reviewState, setReviewState] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Review Queue'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Sources', path: ROUTES.app.sources.overview },
        { label: 'Review queue', path: ROUTES.app.sources.reviewQueue },
      ]),
    );
  }, [dispatch]);

  const candidatesQuery = useSourceCandidates({ status: 'pending_review' });
  const { candidates, isLoading, isError, refetch } = candidatesQuery;

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
      await refetch();
    } catch (err) {
      toast.error('Decision failed', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (candidate) => {
    try {
      await sourcesApi.registerCandidate(candidate.id, {});
      toast.success('Candidate registered', {
        description: 'It will appear in your sources list for validation.',
      });
      await refetch();
    } catch (err) {
      toast.error('Registration failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Review Queue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discovered candidates awaiting review. Approval authorizes the next lifecycle
            stage — not live trading.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => refetch()}
          className="border border-border"
        >
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </IconButton>
      </div>

      {isLoading ? (
        <LoadingState label="Loading candidates" />
      ) : isError ? (
        <ErrorState
          title="Unable to load candidates"
          description="We could not fetch the review queue."
          onRetry={refetch}
        />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Review queue is empty"
          description="No signal candidates are waiting for review. New candidates appear only from sources you explicitly connect and monitor."
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 pt-5">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onApprove={(c) => setReviewState({ candidate: c, decision: 'approve' })}
                onReject={(c) => setReviewState({ candidate: c, decision: 'reject' })}
                onInspect={(c) => handleRegister(c)}
              />
            ))}
          </CardContent>
        </Card>
      )}

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
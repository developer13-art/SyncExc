import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Send, XCircle } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SignalDetails as SignalDetailsContent } from '../../components/domain/signal/SignalDetails.jsx';
import { SignalTimeline } from './components/SignalTimeline.jsx';
import { IssueBadge } from './components/IssueBadge.jsx';
import { ReviewForm } from './components/ReviewForm.jsx';
import { useSignal } from '../../hooks/useSignals.js';
import { signalsApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function SignalDetails() {
  const { signalId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const signalQuery = useSignal(signalId);
  const { signal, versions, issues, eligibility, isLoading, error, createIntent } = signalQuery;

  const [submitting, setSubmitting] = useState(false);
  const [creatingIntent, setCreatingIntent] = useState(false);

  useEffect(() => {
    if (signal) {
      dispatch(uiActions.setPageTitle(signal.instrument ?? signal.symbol ?? 'Signal'));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Signals', path: ROUTES.app.signals.overview },
          {
            label: signal.instrument ?? signal.symbol ?? 'Signal',
            path: ROUTES.app.signals.details(signal.id),
          },
        ]),
      );
    }
  }, [signal, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading signal" />;
  }

  if (error || !signal) {
    return (
      <ErrorState
        title="Unable to load signal"
        description="This signal could not be retrieved."
        onRetry={signalQuery.refetch}
      />
    );
  }

  const needsReview = signal.status === 'review_required';
  const isEligible = signal.status === 'eligible';

  const handleReview = async ({ decision, reason }) => {
    setSubmitting(true);
    try {
      await signalsApi.submitReview(signalId, { decision, reason });
      toast.success('Review submitted');
      await signalQuery.refetch?.();
    } catch (err) {
      toast.error('Review failed', { description: getErrorMessage(err) });
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIntent = async () => {
    setCreatingIntent(true);
    try {
      await createIntent({});
      toast.success('Execution intent created', {
        description: 'The downstream workflow will evaluate authorization and risk.',
      });
    } catch (err) {
      toast.error('Intent creation failed', { description: getErrorMessage(err) });
    } finally {
      setCreatingIntent(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.signals.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {signal.instrument ?? signal.symbol ?? 'Signal'}
          </h1>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">{signal.id}</p>
        </div>
        <div className="flex gap-2">
          {needsReview ? (
            <Button variant="outline" asChild>
              <a href="#review">Review now</a>
            </Button>
          ) : null}
          {isEligible ? (
            <Button onClick={handleCreateIntent} disabled={creatingIntent}>
              <Send className="h-4 w-4" />
              {creatingIntent ? 'Creating…' : 'Create execution intent'}
            </Button>
          ) : null}
        </div>
      </div>

      {issues.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Detected issues</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {issues.map((issue, i) => (
              <IssueBadge
                key={i}
                type={issue.type}
                severity={issue.severity}
                label={issue.label}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <SignalDetailsContent signal={signal} />

      {eligibility ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Eligibility decision</CardTitle>
              <div className="flex items-center gap-2">
                {eligibility.outcome === 'eligible_for_handoff' ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {eligibility.outcome?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {eligibility.reason ?? 'No reason recorded.'}
            </p>
            {eligibility.ruleSetVersion ? (
              <p className="text-2xs text-muted-foreground">
                Rule set version: {eligibility.ruleSetVersion}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {versions?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Version {version.versionNumber ?? version.version}
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {version.createdAt ?? ''}
                    {version.createdBy ? ` · ${version.createdBy}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {signal.timeline?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Processing timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalTimeline events={signal.timeline} />
          </CardContent>
        </Card>
      ) : null}

      {needsReview ? (
        <div id="review">
          <ReviewForm signal={signal} onSubmit={handleReview} isSubmitting={submitting} />
        </div>
      ) : null}
    </div>
  );
}
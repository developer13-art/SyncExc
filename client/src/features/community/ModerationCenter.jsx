import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { communityApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/Dialog.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { useToast } from '../../hooks/useToast.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

function CaseList({ items, emptyMessage, onAppeal }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {item.resource_type} · {item.reason.replace(/_/g, ' ')}
            </p>
            <span className="text-xs capitalize text-muted-foreground">{item.state}</span>
          </div>
          {item.details ? <p className="mt-2 text-sm text-muted-foreground">{item.details}</p> : null}
          <p className="mt-2 text-2xs text-muted-foreground">
            Submitted {item.opened_at ? formatDateTime(item.opened_at) : ''}
          </p>
          {onAppeal ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.appeal_status ? (
                <span className="text-xs capitalize text-muted-foreground">
                  Appeal {item.appeal_status}
                </span>
              ) : null}
              {['resolved', 'dismissed'].includes(item.state) &&
              item.appeal_status !== 'pending' ? (
                <Button size="sm" variant="outline" onClick={() => onAppeal(item)}>
                  Appeal decision
                </Button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default function ModerationCenter() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedCase, setSelectedCase] = useState(null);
  const [reason, setReason] = useState('');
  const reportsQuery = useQuery({
    queryKey: queryKeys.community.myReports({}),
    queryFn: () => communityApi.listMyReports({}),
  });
  const casesQuery = useQuery({
    queryKey: queryKeys.community.myModerationCases({}),
    queryFn: () => communityApi.listMyModerationCases({}),
  });
  const appealMutation = useMutation({
    mutationFn: ({ caseId, appealReason }) =>
      communityApi.submitModerationAppeal(caseId, { reason: appealReason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.community.myModerationCases({}),
      });
      setReason('');
      setSelectedCase(null);
      toast.success('Appeal submitted');
    },
    onError: (error) => toast.error('Appeal failed', { description: getErrorMessage(error) }),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Reports and appeals'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Community', path: ROUTES.app.community.overview },
      { label: 'Reports and appeals', path: ROUTES.app.community.moderation },
    ]));
  }, [dispatch]);

  if (reportsQuery.isLoading || casesQuery.isLoading) {
    return <LoadingState label="Loading reports" />;
  }
  if (reportsQuery.isError || casesQuery.isError) {
    return (
      <ErrorState
        title="Unable to load reports"
        description="Your report and appeal history could not be retrieved."
        onRetry={() => {
          reportsQuery.refetch();
          casesQuery.refetch();
        }}
      />
    );
  }

  const reports = reportsQuery.data?.items ?? [];
  const cases = casesQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.app.community.myProfile)} className="self-start">
        Back to profile
      </Button>
      <Card>
        <CardHeader><CardTitle>Reports you submitted</CardTitle></CardHeader>
        <CardContent>
          <CaseList
            items={reports}
            emptyMessage="You have not submitted any reports."
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Decisions about your content</CardTitle></CardHeader>
        <CardContent>
          <CaseList
            items={cases}
            emptyMessage="There are no moderation decisions on your content."
            onAppeal={setSelectedCase}
          />
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedCase)}
        onOpenChange={(open) => { if (!open) setSelectedCase(null); }}
      >
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (selectedCase && reason.trim().length >= 10) {
                appealMutation.mutate({
                  caseId: selectedCase.id,
                  appealReason: reason.trim(),
                });
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Appeal moderation decision</DialogTitle>
              <DialogDescription>
                Explain why this decision should be reviewed. Appeals require at least 10 characters.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              className="mt-4"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Explain your appeal"
            />
            {appealMutation.error ? (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {getErrorMessage(appealMutation.error)}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedCase(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={reason.trim().length < 10 || appealMutation.isPending}
              >
                {appealMutation.isPending ? 'Submitting…' : 'Submit appeal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

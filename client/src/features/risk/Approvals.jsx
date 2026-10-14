import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { RefreshCw, ShieldAlert } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { ApprovalRow } from './components/ApprovalRow.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { useRiskApprovals } from '../../hooks/useRisk.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export default function Approvals() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [status, setStatus] = useState('pending');
  const [decision, setDecision] = useState(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Approvals'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Risk', path: ROUTES.app.risk.overview },
        { label: 'Approvals', path: ROUTES.app.risk.approvals },
      ]),
    );
  }, [dispatch]);

  const approvalsQuery = useRiskApprovals({ status: status === 'all' ? undefined : status });
  const { approve, reject } = useRiskApprovals({});

  const approvals = approvalsQuery.approvals ?? [];

  const handleDecision = async () => {
    if (!decision) {
      return;
    }
    setProcessing(true);
    try {
      if (decision.action === 'approve') {
        await approve({ approvalId: decision.approval.id, reason: decisionReason.trim() });
        toast.success('Approval granted');
      } else {
        await reject({ approvalId: decision.approval.id, reason: decisionReason.trim() });
        toast.success('Approval rejected');
      }
      setDecision(null);
      setDecisionReason('');
    } catch (err) {
      toast.error('Action failed', { description: getErrorMessage(err) });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Approvals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operations requiring additional authorization appear here. Separation of duties
            prevents self-approval where required.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => approvalsQuery.refetch?.()}
          className="border border-border"
        >
          <RefreshCw
            className={approvalsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />

      <Card>
        <CardContent className="p-5 pt-5">
          {approvalsQuery.isLoading ? (
            <LoadingState label="Loading approvals" />
          ) : approvalsQuery.isError ? (
            <ErrorState
              title="Unable to load approvals"
              description="We could not fetch approval requests."
              onRetry={approvalsQuery.refetch}
            />
          ) : approvals.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No approvals"
              description="Approval requests matching this filter will appear here."
              size="sm"
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {approvals.map((approval) => (
                <ApprovalRow
                  key={approval.id}
                  approval={approval}
                  onApprove={(a) => setDecision({ action: 'approve', approval: a })}
                  onReject={(a) => setDecision({ action: 'reject', approval: a })}
                  isProcessing={processing}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open) {
            setDecision(null);
            setDecisionReason('');
          }
        }}
        title={decision?.action === 'approve' ? 'Approve operation' : 'Reject operation'}
        description={
          decision?.action === 'approve'
            ? 'The operation will be dispatched after all checks pass. Approval applies only to this specific operation.'
            : 'The operation will not proceed. The requester will be notified with the reason.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant={decision?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleDecision}
              disabled={processing || !decisionReason.trim()}
            >
              {processing
                ? 'Submitting…'
                : decision?.action === 'approve'
                  ? 'Confirm approval'
                  : 'Confirm rejection'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Reason</label>
          <Textarea
            rows={3}
            value={decisionReason}
            onChange={(e) => setDecisionReason(e.target.value)}
            placeholder={
              decision?.action === 'approve'
                ? 'Explain why this operation is approved'
                : 'Explain why this operation is rejected'
            }
          />
        </div>
      </Modal>
    </div>
  );
}
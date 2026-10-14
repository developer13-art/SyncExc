import { Check, X } from 'lucide-react';

import { Button } from '../../ui/Button.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';

export function ApprovalRow({ approval, onApprove, onReject, isProcessing }) {
  if (!approval) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border py-3 last:border-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {approval.operationSummary ?? approval.action}
          </p>
          <Badge variant="warning">{approval.status ?? 'pending'}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Requested by {approval.requestedBy ?? 'unknown'} ·{' '}
          {formatDateTime(approval.createdAt)}
        </p>
        {approval.reason ? (
          <p className="mt-1.5 text-xs text-foreground">{approval.reason}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReject?.(approval)}
          disabled={isProcessing}
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
        <Button size="sm" onClick={() => onApprove?.(approval)} disabled={isProcessing}>
          <Check className="h-3.5 w-3.5" />
          Approve
        </Button>
      </div>
    </div>
  );
}
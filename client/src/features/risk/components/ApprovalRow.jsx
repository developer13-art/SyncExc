import { Check, X } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function ApprovalRow({ approval, onApprove, onReject, isProcessing, className }) {
  if (!approval) {
    return null;
  }

  const isPending = approval.status === 'pending';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border py-4 last:border-0 md:flex-row md:items-start md:justify-between',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {approval.operationSummary ?? approval.action}
          </p>
          <Badge variant={isPending ? 'warning' : 'muted'}>
            {approval.status ?? 'pending'}
          </Badge>
          {approval.requiresSecondApprover ? (
            <Badge variant="info">Dual approval</Badge>
          ) : null}
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Requested by {approval.requestedBy ?? 'unknown'} ·{' '}
          {approval.createdAt ? formatDateTime(approval.createdAt) : '—'}
        </p>

        {approval.reason ? (
          <p className="mt-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground">
            {approval.reason}
          </p>
        ) : null}

        {approval.projectedExposure ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Projected exposure: <span className="font-medium text-foreground">
              {approval.projectedExposure}
            </span>
          </p>
        ) : null}

        {approval.expiresAt ? (
          <p className="mt-1 text-2xs text-muted-foreground">
            Expires {formatDateTime(approval.expiresAt)}
          </p>
        ) : null}
      </div>

      {isPending ? (
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReject?.(approval)}
            disabled={isProcessing}
          >
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
          <Button
            size="sm"
            onClick={() => onApprove?.(approval)}
            disabled={isProcessing}
          >
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        </div>
      ) : null}
    </div>
  );
}
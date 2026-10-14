import { Check, ExternalLink, X } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function CandidateCard({ candidate, onApprove, onReject, onInspect, className }) {
  if (!candidate) {
    return null;
  }

  const confidenceTone =
    candidate.confidence >= 0.8
      ? 'success'
      : candidate.confidence >= 0.5
        ? 'warning'
        : 'muted';

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {candidate.name ?? candidate.proposedName}
            </p>
            {candidate.platform ? (
              <Badge variant="muted">{candidate.platform}</Badge>
            ) : null}
            {typeof candidate.confidence === 'number' ? (
              <Badge variant={confidenceTone}>
                {Math.round(candidate.confidence * 100)}% confidence
              </Badge>
            ) : null}
            {candidate.duplicateOf ? (
              <Badge variant="destructive">Possible duplicate</Badge>
            ) : null}
          </div>

          {candidate.description ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
              {candidate.description}
            </p>
          ) : null}

          {candidate.claimedUrl ? (
            <a
              href={candidate.claimedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-2xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {candidate.claimedUrl}
            </a>
          ) : null}

          {candidate.evidence?.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {candidate.evidence.slice(0, 4).map((item, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground"
                >
                  {item.label ?? item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => onInspect?.(candidate)}>
          Inspect
        </Button>
        <Button variant="outline" size="sm" onClick={() => onReject?.(candidate)}>
          <X className="h-3.5 w-3.5" /> Reject
        </Button>
        <Button size="sm" onClick={() => onApprove?.(candidate)}>
          <Check className="h-3.5 w-3.5" /> Approve
        </Button>
      </div>
    </Card>
  );
}
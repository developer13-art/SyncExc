import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Clock, Target } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { SignalStatusBadge } from './SignalStatusBadge.jsx';
import { SignalConfidenceBadge } from './SignalConfidenceBadge.jsx';
import { SignalIssueBadge } from './SignalIssueBadge.jsx';
import { formatDateTime, humanizeAge } from '../../../lib/formatters/date.formatter.js';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function SignalCard({ signal, href, className }) {
  if (!signal) {
    return null;
  }

  const isLong = signal.direction === 'long' || signal.direction === 'buy';
  const DirectionIcon = isLong ? ArrowUpRight : ArrowDownRight;
  const directionClass = isLong ? 'text-success' : 'text-destructive';
  const topIssues = (signal.issues ?? []).slice(0, 3);
  const linkTo = href ?? ROUTES.app.signals.details(signal.id);

  return (
    <Card className={cn('overflow-hidden transition hover:border-primary/40', className)}>
      <Link to={linkTo} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <DirectionIcon className={cn('h-4 w-4 shrink-0', directionClass)} />
            <span className="truncate text-sm font-semibold text-foreground">
              {signal.instrument ?? signal.symbol ?? 'Unknown instrument'}
            </span>
            <SignalStatusBadge status={signal.status} />
          </div>
          <SignalConfidenceBadge level={signal.confidence?.level} score={signal.confidence?.overall} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          {signal.entry !== undefined ? (
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Entry</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatQuantity(signal.entry, 6)}
                {signal.entryRange ? (
                  <span className="text-muted-foreground">
                    {' '}
                    – {formatQuantity(signal.entryRange.high, 6)}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}

          {signal.stopLoss !== undefined ? (
            <div>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">SL</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatQuantity(signal.stopLoss, 6)}
              </p>
            </div>
          ) : null}

          {signal.targets?.length > 0 ? (
            <div className="col-span-2">
              <p className="flex items-center gap-1 text-2xs uppercase tracking-wide text-muted-foreground">
                <Target className="h-3 w-3" /> Targets
              </p>
              <p className="mt-0.5 flex flex-wrap gap-2 font-medium text-foreground">
                {signal.targets.map((t, i) => (
                  <span key={i}>
                    {t.label ? `${t.label}: ` : ''}
                    {formatQuantity(t.price, 6)}
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </div>

        {topIssues.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topIssues.map((issue, i) => (
              <SignalIssueBadge
                key={i}
                type={issue.type}
                severity={issue.severity}
                label={issue.label}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {signal.occurredAt ? formatDateTime(signal.occurredAt) : '—'}
          </span>
          <span>{signal.occurredAt ? humanizeAge(signal.occurredAt) : ''}</span>
        </div>
      </Link>
    </Card>
  );
}
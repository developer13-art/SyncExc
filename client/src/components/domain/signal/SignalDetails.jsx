import { ArrowDownRight, ArrowUpRight, Clock, ExternalLink, Target } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card.jsx';
import { SignalStatusBadge } from './SignalStatusBadge.jsx';
import { SignalConfidenceBadge } from './SignalConfidenceBadge.jsx';
import { SignalIssueBadge } from './SignalIssueBadge.jsx';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function SignalDetails({ signal, className }) {
  if (!signal) {
    return null;
  }

  const isLong = signal.direction === 'long' || signal.direction === 'buy';
  const DirectionIcon = isLong ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <DirectionIcon
                className={cn('h-5 w-5', isLong ? 'text-success' : 'text-destructive')}
              />
              <CardTitle>
                {signal.instrument ?? signal.symbol ?? 'Unknown instrument'}
              </CardTitle>
              <SignalStatusBadge status={signal.status} />
            </div>
            <SignalConfidenceBadge
              level={signal.confidence?.level}
              score={signal.confidence?.overall}
            />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Direction" value={signal.direction?.toUpperCase() ?? '—'} />
          <Field label="Market" value={signal.marketType ?? '—'} />
          <Field label="Entry" value={signal.entry ? formatQuantity(signal.entry, 6) : '—'} />
          <Field
            label="Stop Loss"
            value={signal.stopLoss ? formatQuantity(signal.stopLoss, 6) : '—'}
          />
          {signal.targets?.length > 0 ? (
            <div className="col-span-2 md:col-span-4">
              <p className="flex items-center gap-1 text-2xs uppercase tracking-wide text-muted-foreground">
                <Target className="h-3 w-3" /> Targets
              </p>
              <div className="mt-1 flex flex-wrap gap-3">
                {signal.targets.map((t, i) => (
                  <span key={i} className="text-sm font-medium text-foreground">
                    {t.label ? `${t.label}: ` : ''}
                    {formatQuantity(t.price, 6)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <Field label="Leverage" value={signal.leverage ?? 'Not stated'} />
          <Field
            label="Occurred"
            value={signal.occurredAt ? formatDateTime(signal.occurredAt) : '—'}
          />
        </CardContent>
      </Card>

      {signal.issues?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Detected Issues</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {signal.issues.map((issue, i) => (
              <SignalIssueBadge
                key={i}
                type={issue.type}
                severity={issue.severity}
                label={issue.label}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {signal.source ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Source</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Field label="Source" value={signal.source.name ?? signal.source.id} />
            {signal.source.url ? (
              <a
                href={signal.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Open source
              </a>
            ) : null}
            {signal.source.occurredAt ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDateTime(signal.source.occurredAt)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {signal.evidence ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 font-mono text-xs text-foreground">
              {signal.evidence}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
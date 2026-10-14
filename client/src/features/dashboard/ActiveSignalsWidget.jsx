import { Link } from 'react-router-dom';
import { ArrowRight, Radio } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { SignalStatusBadge } from '../../components/domain/signal/SignalStatusBadge.jsx';
import { SignalConfidenceBadge } from '../../components/domain/signal/SignalConfidenceBadge.jsx';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function ActiveSignalsWidget({ signals = [], isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Unable to load recent signals.</p>
        </CardContent>
      </Card>
    );
  }

  if (signals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Radio}
            title="No recent signals"
            description="Signals from approved sources will appear here."
            size="sm"
            className="border-0 bg-transparent py-6"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Signals</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.signals.overview}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border p-0">
        {signals.slice(0, 5).map((signal) => (
          <Link
            key={signal.id}
            to={ROUTES.app.signals.details(signal.id)}
            className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {signal.instrument ?? signal.symbol}
                </p>
                <SignalStatusBadge status={signal.status} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    'text-2xs font-medium uppercase',
                    signal.direction === 'long' || signal.direction === 'buy'
                      ? 'text-success'
                      : 'text-destructive',
                  )}
                >
                  {signal.direction}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {signal.occurredAt ? formatRelativeTime(signal.occurredAt) : ''}
                </span>
              </div>
            </div>
            <SignalConfidenceBadge
              level={signal.confidence?.level}
              score={signal.confidence?.overall}
            />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
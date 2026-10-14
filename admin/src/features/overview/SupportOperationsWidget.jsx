import { Link } from 'react-router-dom';
import { Headphones, AlertTriangle, Clock, Inbox } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatNumber } from '../../lib/formatters/number.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function SupportOperationsWidget({ data, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Support operations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Support operations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No support data available.</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      icon: Inbox,
      label: 'Open tickets',
      value: formatNumber(data.openTickets ?? 0, { maximumFractionDigits: 0 }),
    },
    {
      icon: AlertTriangle,
      label: 'Urgent / escalated',
      value: formatNumber(data.urgentTickets ?? 0, { maximumFractionDigits: 0 }),
      tone: data.urgentTickets > 0 ? 'destructive' : undefined,
    },
    {
      icon: Clock,
      label: 'Approaching SLA',
      value: formatNumber(data.approachingSla ?? 0, { maximumFractionDigits: 0 }),
      tone: data.approachingSla > 0 ? 'warning' : undefined,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Support operations</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.console.support.overview}>Open</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <li
                key={metric.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      metric.tone === 'warning' && 'text-warning',
                      metric.tone === 'destructive' && 'text-destructive',
                    )}
                  />
                  <span className="truncate">{metric.label}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 font-medium',
                    metric.tone === 'warning' && 'text-warning',
                    metric.tone === 'destructive' && 'text-destructive',
                    !metric.tone && 'text-foreground',
                  )}
                >
                  {metric.value}
                </span>
              </li>
            );
          })}
        </ul>

        {data.oldestUnansweredAge ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-2xs text-muted-foreground">
            Oldest unanswered ticket: {data.oldestUnansweredAge}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
import { Link } from 'react-router-dom';
import { Radio, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatNumber } from '../../lib/formatters/number.formatter.js';
import { formatPercent } from '../../lib/formatters/percent.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function SignalIntelligenceWidget({ data, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Signal intelligence</CardTitle>
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
          <CardTitle>Signal intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No signal intelligence data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      icon: CheckCircle2,
      tone: 'info',
      label: 'Candidates awaiting review',
      value: formatNumber(data.candidatesAwaitingReview ?? 0, {
        maximumFractionDigits: 0,
      }),
      href: ROUTES.console.sourceDiscovery.candidates,
    },
    {
      icon: AlertTriangle,
      tone: data.validationFailures > 0 ? 'warning' : 'default',
      label: 'Validation failures (24h)',
      value: formatNumber(data.validationFailures ?? 0, {
        maximumFractionDigits: 0,
      }),
    },
    {
      icon: TrendingUp,
      tone: data.sourceOutages > 0 ? 'warning' : 'success',
      label: 'Source outages',
      value: formatNumber(data.sourceOutages ?? 0, { maximumFractionDigits: 0 }),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Signal intelligence</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.console.sourceDiscovery.candidates}>Review queue</Link>
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
                      metric.tone === 'info' && 'text-info',
                      metric.tone === 'success' && 'text-success',
                    )}
                  />
                  <span className="truncate">{metric.label}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 font-medium',
                    metric.tone === 'warning' && 'text-warning',
                    !metric.tone && 'text-foreground',
                  )}
                >
                  {metric.value}
                </span>
              </li>
            );
          })}
        </ul>

        {data.parsingSuccessRate !== undefined ? (
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Parsing success (24h)</span>
              <span
                className={cn(
                  'font-medium',
                  data.parsingSuccessRate >= 0.95
                    ? 'text-success'
                    : data.parsingSuccessRate >= 0.8
                      ? 'text-warning'
                      : 'text-destructive',
                )}
              >
                {formatPercent(data.parsingSuccessRate, {
                  decimals: 1,
                  already100: true,
                })}
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
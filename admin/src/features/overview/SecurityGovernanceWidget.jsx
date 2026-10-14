import { Link } from 'react-router-dom';
import { AlertTriangle, KeyRound, ShieldAlert, UserCheck } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatNumber } from '../../lib/formatters/number.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function SecurityGovernanceWidget({ data, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Security & governance</CardTitle>
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
          <CardTitle>Security & governance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No security governance data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      icon: UserCheck,
      label: 'Pending approvals',
      value: formatNumber(data.pendingApprovals ?? 0, { maximumFractionDigits: 0 }),
      tone: data.pendingApprovals > 0 ? 'warning' : undefined,
      href: ROUTES.console.approvals.overview,
    },
    {
      icon: KeyRound,
      label: 'Temporary access grants',
      value: formatNumber(data.temporaryAccessGrants ?? 0, {
        maximumFractionDigits: 0,
      }),
      href: ROUTES.console.roles.overview,
    },
    {
      icon: AlertTriangle,
      label: 'Suspicious access attempts (24h)',
      value: formatNumber(data.suspiciousAccessAttempts ?? 0, {
        maximumFractionDigits: 0,
      }),
      tone: data.suspiciousAccessAttempts > 0 ? 'destructive' : undefined,
    },
    {
      icon: ShieldAlert,
      label: 'Denied operations (24h)',
      value: formatNumber(data.deniedOperations ?? 0, { maximumFractionDigits: 0 }),
      tone: data.deniedOperations > 20 ? 'warning' : undefined,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Security & governance</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.console.audit.overview}>View audit</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
      </CardContent>
    </Card>
  );
}
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

export function ExchangeInfrastructureWidget({ data, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exchange infrastructure</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Exchange infrastructure</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Unable to load exchange health.</p>
        </CardContent>
      </Card>
    );
  }

  const exchanges = data?.exchanges ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Exchange infrastructure</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.console.exchanges.overview}>
              View all <RefreshCw className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {exchanges.length === 0 ? (
          <EmptyState
            title="No exchanges registered"
            description="Exchange adapters will appear here once they are registered."
            size="sm"
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="divide-y divide-border">
            {exchanges.map((exchange) => {
              const healthy = exchange.status === 'healthy';
              const degraded = exchange.status === 'degraded';
              const unavailable = exchange.status === 'unavailable';
              return (
                <li key={exchange.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {exchange.name}
                        </p>
                        {exchange.adapterVersion ? (
                          <span className="text-2xs text-muted-foreground">
                            v{exchange.adapterVersion}
                          </span>
                        ) : null}
                      </div>
                      {exchange.detail ? (
                        <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                          {exchange.detail}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      variant={
                        healthy
                          ? 'success'
                          : degraded
                            ? 'warning'
                            : unavailable
                              ? 'destructive'
                              : 'muted'
                      }
                    >
                      {healthy ? (
                        'Healthy'
                      ) : degraded ? (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Degraded
                        </span>
                      ) : unavailable ? (
                        'Unavailable'
                      ) : (
                        exchange.status ?? 'unknown'
                      )}
                    </Badge>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-3 text-2xs md:grid-cols-4">
                    {exchange.connectionCount !== undefined ? (
                      <div>
                        <p className="text-muted-foreground">Connections</p>
                        <p className="font-medium text-foreground">
                          {exchange.connectionCount}
                        </p>
                      </div>
                    ) : null}
                    {exchange.failureRate !== undefined ? (
                      <div>
                        <p className="text-muted-foreground">Failure rate</p>
                        <p
                          className={cn(
                            'font-medium',
                            exchange.failureRate < 0.01
                              ? 'text-success'
                              : exchange.failureRate < 0.05
                                ? 'text-warning'
                                : 'text-destructive',
                          )}
                        >
                          {(exchange.failureRate * 100).toFixed(2)}%
                        </p>
                      </div>
                    ) : null}
                    {exchange.rateLimitPressure !== undefined ? (
                      <div>
                        <p className="text-muted-foreground">Rate-limit pressure</p>
                        <div className="mt-1">
                          <ProgressBar
                            value={Math.min(100, exchange.rateLimitPressure * 100)}
                            indicatorClassName={
                              exchange.rateLimitPressure < 0.5
                                ? 'bg-success'
                                : exchange.rateLimitPressure < 0.8
                                  ? 'bg-warning'
                                  : 'bg-destructive'
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                    {exchange.activeIncidents !== undefined ? (
                      <div>
                        <p className="text-muted-foreground">Incidents</p>
                        <p
                          className={cn(
                            'font-medium',
                            exchange.activeIncidents > 0
                              ? 'text-destructive'
                              : 'text-foreground',
                          )}
                        >
                          {exchange.activeIncidents}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, Headphones, MessageSquare } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { supportApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';

export default function SupportOverview() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Support Operations'));
    dispatch(
      adminUiActions.setBreadcrumbs([{ label: 'Support', path: '/support' }]),
    );
  }, [dispatch]);

  const metricsQuery = useQuery({
    queryKey: ['support', 'metrics', 'overview'],
    queryFn: () => supportApi.metrics({}),
  });

  if (metricsQuery.isLoading) {
    return <LoadingState label="Loading support metrics" />;
  }

  const metrics = metricsQuery.data ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Support Operations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Queues, escalations, and service metrics for the Customer Support Portal.
            Support access never grants trading authority.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/support/queues">Queues</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/support/metrics">Metrics</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={metrics.openTickets ?? 0}
          icon={MessageSquare}
        />
        <StatCard
          label="Awaiting customer"
          value={metrics.awaitingCustomer ?? 0}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Approaching target"
          value={metrics.approachingTarget ?? 0}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Escalated"
          value={metrics.escalated ?? 0}
          icon={AlertCircle}
          tone="destructive"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Response times</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">First response (median)</span>
              <span className="font-medium text-foreground">
                {metrics.medianFirstResponseMinutes ?? '—'} min
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Resolution (median)</span>
              <span className="font-medium text-foreground">
                {metrics.medianResolutionHours ?? '—'} h
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reopened rate</span>
              <span className="font-medium text-foreground">
                {metrics.reopenedRate !== undefined
                  ? `${(metrics.reopenedRate * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Attachment scan failures</span>
              <span className="font-medium text-foreground">
                {metrics.attachmentScanFailures ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Support integration issues</span>
              <span className="font-medium text-foreground">
                {metrics.integrationIssues ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Linked incidents</span>
              <span className="font-medium text-foreground">
                {metrics.linkedIncidents ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          A ticket does not authorize support staff to execute trades, alter risk rules, or
          access exchange credentials. Internal notes are never visible to customers.
        </CardContent>
      </Card>
    </div>
  );
}
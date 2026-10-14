import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useRiskIncidents } from '../../hooks/useRisk.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const SEVERITY_VARIANTS = {
  critical: 'destructive',
  high: 'destructive',
  warning: 'warning',
  info: 'info',
  low: 'muted',
};

export default function Incidents() {
  const dispatch = useDispatch();
  const incidentsQuery = useRiskIncidents({});

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Risk Incidents'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Risk', path: ROUTES.app.risk.overview },
        { label: 'Incidents', path: ROUTES.app.risk.incidents },
      ]),
    );
  }, [dispatch]);

  const incidents = incidentsQuery.incidents ?? [];

  const columns = [
    {
      key: 'createdAt',
      label: 'Detected',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.createdAt ? formatRelativeTime(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <span className="text-xs text-foreground">
          {row.category?.replace(/_/g, ' ') ?? '—'}
        </span>
      ),
    },
    {
      key: 'summary',
      label: 'Summary',
      render: (row) => (
        <Link
          to={ROUTES.app.risk.incident(row.id)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {row.summary ?? 'View incident'}
        </Link>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row) => (
        <Badge variant={SEVERITY_VARIANTS[row.severity] ?? 'muted'}>
          {row.severity ?? 'unknown'}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'resolved' ? 'success' : 'warning'}>
          {row.status ?? 'open'}
        </Badge>
      ),
    },
    {
      key: 'assignedTo',
      label: 'Assigned to',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.assignedTo ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Risk Incidents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Execution incidents requiring investigation, containment, or controlled recovery.
          </p>
        </div>
        <IconButton
          label="Refresh"
          onClick={() => incidentsQuery.refetch?.()}
          className="border border-border"
        >
          <RefreshCw
            className={incidentsQuery.isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
        </IconButton>
      </div>

      <Card>
        <CardContent className="p-5 pt-5">
          <DataTable
            columns={columns}
            rows={incidents}
            isLoading={incidentsQuery.isLoading}
            emptyTitle="No open incidents"
            emptyDescription="Risk incidents appear here when they are opened."
            emptyIcon={AlertTriangle}
          />
        </CardContent>
      </Card>
    </div>
  );
}
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Database, RefreshCw, Server } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { consoleApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { formatFileSize, formatNumber } from '../../lib/formatters/number.formatter.js';
import { humanize, statusVariant } from './console.utils.js';

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value ?? '—'}</p>
      {hint ? <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatusRow({ label, detail, status }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {detail ? <p className="truncate text-2xs text-muted-foreground">{detail}</p> : null}
      </div>
      <Badge variant={statusVariant(status)}>{humanize(status)}</Badge>
    </div>
  );
}

function Distribution({ values }) {
  const entries = Object.entries(values || {});
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No records.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <Badge key={key} variant={statusVariant(key)}>
          {humanize(key)}: {formatNumber(value)}
        </Badge>
      ))}
    </div>
  );
}

export function ConsoleSystem({ page, section }) {
  const systemQuery = useQuery({
    queryKey: queryKeys.console.system,
    queryFn: () => consoleApi.system(),
    refetchInterval: 30_000,
  });

  const data = systemQuery.data;

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {section.label}
                </p>
                <Badge variant="success" size="sm">Live telemetry</Badge>
                {data?.environment ? (
                  <Badge variant="muted" size="sm">{data.environment}</Badge>
                ) : null}
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {humanize(page.pageId)}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Database, job, event, exchange and storage health. Values refresh every 30 seconds.
                {data?.generatedAt ? ` Last generated ${formatDateTime(data.generatedAt)}.` : ''}
              </p>
            </div>
          </div>
          <IconButton
            label="Refresh system health"
            onClick={() => systemQuery.refetch()}
            disabled={systemQuery.isFetching}
            className="border border-border bg-background/70"
          >
            <RefreshCw className={systemQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          </IconButton>
        </div>
      </div>

      {systemQuery.isLoading ? (
        <LoadingState label="Reading system health" />
      ) : systemQuery.isError ? (
        <ErrorState
          title="System health unavailable"
          description={getErrorMessage(systemQuery.error)}
          onRetry={() => systemQuery.refetch()}
        />
      ) : (
        <>
          {data.warnings?.length > 0 ? (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="flex flex-col gap-2 p-4 pt-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  {data.warnings.length} active warning{data.warnings.length === 1 ? '' : 's'}
                </div>
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Subsystems
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {(data.subsystems || []).map((subsystem) => (
                  <StatusRow
                    key={subsystem.key}
                    label={subsystem.label}
                    detail={subsystem.detail}
                    status={subsystem.status}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" /> Database
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Metric
                  label="Health"
                  value={data.database?.ok ? 'Healthy' : 'Failing'}
                  hint={data.database?.latencyMs != null ? `${data.database.latencyMs} ms` : data.database?.error}
                />
                <Metric label="Size" value={data.database?.sizePretty || formatFileSize(data.database?.sizeBytes)} />
                <Metric label="Migrations applied" value={formatNumber(data.database?.migrationsApplied)} />
                <Metric label="Tables" value={formatNumber(data.database?.tables)} />
                <Metric label="Pool total" value={formatNumber(data.database?.pool?.total)} />
                <Metric label="Pool idle / waiting" value={`${formatNumber(data.database?.pool?.idle)} / ${formatNumber(data.database?.pool?.waiting)}`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Background jobs</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Total jobs" value={formatNumber(data.jobs?.total)} />
                  <Metric label="Dead-lettered" value={formatNumber(data.jobs?.deadLettered)} />
                </div>
                <Distribution values={data.jobs?.byStatus} />
                {(data.jobs?.recentFailures || []).length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {data.jobs.recentFailures.map((job) => (
                      <li key={job.id} className="rounded-md border border-border p-2 text-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{job.job_type}</span>
                          <Badge variant={statusVariant(job.status)} size="sm">{humanize(job.status)}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-muted-foreground">{job.last_error || 'No error message'}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event outbox</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Pending" value={formatNumber(data.outbox?.pending)} />
                  <Metric label="Failed" value={formatNumber(data.outbox?.failed)} />
                  <Metric label="Dead-lettered" value={formatNumber(data.outbox?.deadLettered)} />
                  <Metric
                    label="Oldest pending"
                    value={data.outbox?.oldestPendingAgeSeconds
                      ? `${formatNumber(data.outbox.oldestPendingAgeSeconds)}s`
                      : '—'}
                  />
                </div>
                <Distribution values={data.outbox?.byStatus} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exchange connectivity</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Distribution values={data.exchanges?.connectionsByStatus} />
                {(data.exchanges?.unresolvedIncidents || []).length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {data.exchanges.unresolvedIncidents.map((incident, index) => (
                      <li key={`${incident.exchange_code}-${index}`} className="rounded-md border border-warning/30 bg-warning/5 p-2 text-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{incident.exchange_code}</span>
                          <Badge variant={statusVariant(incident.severity)} size="sm">{incident.severity}</Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">{incident.title}</p>
                        <p className="text-muted-foreground">Started {formatDateTime(incident.started_at)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No unresolved exchange incidents.</p>
                )}
                {(data.exchanges?.last24h || []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-2xs">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-2">Exchange</th>
                          <th className="py-1 pr-2 text-right">Requests</th>
                          <th className="py-1 pr-2 text-right">Errors</th>
                          <th className="py-1 text-right">Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.exchanges.last24h.map((row) => (
                          <tr key={row.exchange_code} className="border-t border-border">
                            <td className="py-1 pr-2 text-foreground">{row.exchange_code}</td>
                            <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(row.requests)}</td>
                            <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(row.server_errors)}</td>
                            <td className="py-1 text-right tabular-nums">{formatNumber(row.avg_latency_ms)} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sources, sessions and storage</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div>
                  <p className="mb-1 text-2xs uppercase tracking-wide text-muted-foreground">Signal source health</p>
                  <Distribution values={data.sources?.byHealthState} />
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {formatNumber(data.sources?.monitoring)} sources monitoring.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Active sessions" value={formatNumber(data.sessions?.active)} />
                  <Metric label="Expired sessions" value={formatNumber(data.sessions?.expired)} />
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Object storage</p>
                    <Badge variant={statusVariant(data.storage?.status)}>{humanize(data.storage?.status)}</Badge>
                  </div>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {data.storage?.driver || data.storage?.reason || 'No driver reported'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent deployments</CardTitle>
            </CardHeader>
            <CardContent>
              {(data.deployments || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No deployment records.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3">Version</th>
                        <th className="py-1 pr-3">Environment</th>
                        <th className="py-1 pr-3">Commit</th>
                        <th className="py-1 pr-3">Status</th>
                        <th className="py-1 pr-3">Deployed</th>
                        <th className="py-1">Rolled back</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deployments.map((deployment) => (
                        <tr key={deployment.id} className="border-t border-border">
                          <td className="py-1.5 pr-3 font-medium text-foreground">{deployment.version}</td>
                          <td className="py-1.5 pr-3">{deployment.environment}</td>
                          <td className="py-1.5 pr-3 font-mono text-2xs">{deployment.commit_ref || '—'}</td>
                          <td className="py-1.5 pr-3">
                            <Badge variant={statusVariant(deployment.status)} size="sm">{humanize(deployment.status)}</Badge>
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{formatDateTime(deployment.deployed_at)}</td>
                          <td className="py-1.5 text-muted-foreground">
                            {deployment.rolled_back_at ? formatDateTime(deployment.rolled_back_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default ConsoleSystem;

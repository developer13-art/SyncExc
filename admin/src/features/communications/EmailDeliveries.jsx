import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { adminApi } from '../../api/admin.api.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { formatNumber } from '../../lib/formatters/number.formatter.js';

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-muted/10 p-3">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatNumber(value)}</p>
    </div>
  );
}

function Status({ value }) {
  const variant = value === 'delivered' || value === 'accepted'
    ? 'success'
    : value === 'failed' || value === 'bounced' || value === 'rejected'
      ? 'danger'
      : value === 'pending' || value === 'delayed'
        ? 'warning'
        : 'muted';
  return <Badge variant={variant}>{String(value || 'unknown').replaceAll('_', ' ')}</Badge>;
}

export default function EmailDeliveries() {
  const [filters, setFilters] = useState({
    emailType: '',
    deliveryStatus: '',
    requestStatus: '',
    provider: '',
    recipient: '',
    errorCategory: '',
    dateFrom: '',
    dateTo: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const statsQuery = useQuery({
    queryKey: ['admin', 'email-delivery-stats'],
    queryFn: () => adminApi.getEmailDeliveryStats({ hours: 24 * 30 }),
    refetchInterval: 30_000,
  });
  const deliveriesQuery = useQuery({
    queryKey: ['admin', 'email-deliveries', appliedFilters],
    queryFn: () => adminApi.listEmailDeliveries({ limit: 50, offset: 0, ...appliedFilters }),
    refetchInterval: 30_000,
  });

  const applyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters(Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value.trim()),
    ));
  };
  const stats = statsQuery.data;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Email delivery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Provider acceptance is not proof of inbox delivery. Delivery outcomes update from signed Resend webhook events.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={statsQuery.isFetching || deliveriesQuery.isFetching}
          onClick={() => {
            void statsQuery.refetch();
            void deliveriesQuery.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {statsQuery.isError ? (
        <ErrorState title="Email statistics unavailable" description={getErrorMessage(statsQuery.error)} onRetry={statsQuery.refetch} />
      ) : statsQuery.isLoading ? (
        <LoadingState label="Loading email statistics" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Requests (30 days)" value={stats?.total} />
          <Metric label="Accepted by provider" value={stats?.accepted} />
          <Metric label="Confirmed delivered" value={stats?.delivered} />
          <Metric label="Send failures" value={stats?.failed} />
          <Metric label="Bounced" value={stats?.bounced} />
          <Metric label="Delivery failures" value={stats?.delivery_failed} />
          <Metric label="Complaints" value={stats?.complained} />
          <Metric label="Pending requests" value={stats?.pending} />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Filter email history</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-muted-foreground">
              Email type
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={filters.emailType} onChange={(event) => setFilters({ ...filters, emailType: event.target.value })} placeholder="email_verification" />
            </label>
            <label className="text-xs text-muted-foreground">
              Delivery status
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={filters.deliveryStatus} onChange={(event) => setFilters({ ...filters, deliveryStatus: event.target.value })}>
                <option value="">All statuses</option>
                {['unknown', 'queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'suppressed'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Request status
              <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={filters.requestStatus} onChange={(event) => setFilters({ ...filters, requestStatus: event.target.value })}>
                <option value="">All requests</option>
                {['pending', 'accepted', 'failed', 'skipped'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Provider
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={filters.provider} onChange={(event) => setFilters({ ...filters, provider: event.target.value })} placeholder="resend" />
            </label>
            <label className="text-xs text-muted-foreground">
              Recipient
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={filters.recipient} onChange={(event) => setFilters({ ...filters, recipient: event.target.value })} autoComplete="off" />
            </label>
            <label className="text-xs text-muted-foreground">
              Error category
              <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={filters.errorCategory} onChange={(event) => setFilters({ ...filters, errorCategory: event.target.value })} placeholder="provider_unavailable" />
            </label>
            <label className="text-xs text-muted-foreground">
              From
              <input type="date" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <input type="date" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit">Apply filters</Button>
              <Button type="button" variant="outline" onClick={() => {
                const cleared = {
                  emailType: '', deliveryStatus: '', requestStatus: '', provider: '',
                  recipient: '', errorCategory: '', dateFrom: '', dateTo: '',
                };
                setFilters(cleared);
                setAppliedFilters({});
              }}>Clear</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent requests</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {deliveriesQuery.isLoading ? (
            <LoadingState label="Loading email history" />
          ) : deliveriesQuery.isError ? (
            <ErrorState title="Email history unavailable" description={getErrorMessage(deliveriesQuery.error)} onRetry={deliveriesQuery.refetch} />
          ) : deliveriesQuery.data?.items?.length ? (
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-2 py-3 font-medium">Recipient</th>
                  <th className="px-2 py-3 font-medium">Type / Provider</th>
                  <th className="px-2 py-3 font-medium">Request</th>
                  <th className="px-2 py-3 font-medium">Delivery</th>
                  <th className="px-2 py-3 font-medium">Resend ID</th>
                  <th className="px-2 py-3 font-medium">Failure</th>
                  <th className="px-2 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveriesQuery.data.items.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="break-all px-2 py-3 text-foreground">{row.recipient_email}</td>
                    <td className="px-2 py-3">
                      <p className="font-medium text-foreground">{row.email_type}</p>
                      <p className="text-muted-foreground">{row.provider}</p>
                    </td>
                    <td className="px-2 py-3"><Status value={row.request_status} /></td>
                    <td className="px-2 py-3"><Status value={row.delivery_status} /></td>
                    <td className="break-all px-2 py-3 font-mono text-muted-foreground">{row.provider_message_id || '—'}</td>
                    <td className="max-w-xs px-2 py-3">
                      {row.failure_reason ? <p className="text-destructive">{row.failure_reason}</p> : null}
                      {row.error_category ? <p className="mt-1 text-muted-foreground">{row.error_category}</p> : null}
                      {!row.failure_reason && !row.error_category ? '—' : null}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">No email requests match these filters.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent provider events</CardTitle></CardHeader>
        <CardContent>
          {stats?.recentWebhookEvents?.length ? (
            <ul className="divide-y divide-border">
              {stats.recentWebhookEvents.map((event) => (
                <li key={event.provider_event_id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs">
                  <span className="font-medium text-foreground">{event.event_type}</span>
                  <span className="font-mono text-muted-foreground">{event.provider_message_id || '—'}</span>
                  <span className="text-muted-foreground">{formatDateTime(event.processed_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No signed provider events have been received.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

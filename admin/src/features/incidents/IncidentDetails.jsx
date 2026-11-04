import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { incidentsApi } from '../../api/index.js';
import { getErrorMessage } from '../../lib/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

const SEVERITY_VARIANTS = {
  sev1: 'destructive',
  sev2: 'warning',
  sev3: 'info',
  sev4: 'muted',
};

export default function IncidentDetails() {
  const { incidentId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [eventMessage, setEventMessage] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');

  const incidentQuery = useQuery({
    queryKey: ['admin-incident', incidentId],
    queryFn: () => incidentsApi.get(incidentId),
  });
  const incident = incidentQuery.data?.incident;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-incident', incidentId] }),
      queryClient.invalidateQueries({ queryKey: ['admin-incidents'] }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: () => incidentsApi.update(incidentId, {
      status,
      reason: reason.trim() || undefined,
    }),
    onSuccess: async () => {
      await refresh();
      toast.success('Incident status updated');
      setReason('');
    },
    onError: (error) =>
      toast.error('Incident could not be updated', { description: getErrorMessage(error) }),
  });

  const resolveMutation = useMutation({
    mutationFn: () => incidentsApi.resolve(incidentId, {
      summary: resolutionSummary.trim() || undefined,
    }),
    onSuccess: async () => {
      await refresh();
      toast.success('Incident resolved');
      setResolutionSummary('');
    },
    onError: (error) =>
      toast.error('Incident could not be resolved', { description: getErrorMessage(error) }),
  });

  const eventMutation = useMutation({
    mutationFn: () => incidentsApi.addEvent(incidentId, {
      eventType: 'admin_update',
      message: eventMessage.trim(),
    }),
    onSuccess: async () => {
      await refresh();
      toast.success('Timeline update added');
      setEventMessage('');
    },
    onError: (error) =>
      toast.error('Timeline update could not be added', { description: getErrorMessage(error) }),
  });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle(incident?.reference || 'Incident details'));
    dispatch(adminUiActions.setBreadcrumbs([
      { label: 'Operations', path: '/overview' },
      { label: 'Incidents', path: '/incidents' },
      { label: incident?.reference || 'Details', path: `/incidents/${incidentId}` },
    ]));
  }, [dispatch, incident?.reference, incidentId]);

  useEffect(() => {
    if (incident?.status) setStatus(incident.status);
  }, [incident?.status]);

  if (incidentQuery.isLoading) return <LoadingState label="Loading incident" />;
  if (incidentQuery.isError) {
    return (
      <ErrorState
        title="Incident unavailable"
        description={getErrorMessage(incidentQuery.error)}
        onRetry={incidentQuery.refetch}
      />
    );
  }
  if (!incident) return <ErrorState title="Incident not found" description="The incident record was not returned by the server." />;

  const events = incidentQuery.data?.events ?? [];
  const busy = updateMutation.isPending || resolveMutation.isPending || eventMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/incidents" className="text-sm text-primary hover:underline">← All incidents</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{incident.title}</h1>
          <Badge variant={SEVERITY_VARIANTS[incident.severity] ?? 'muted'}>{incident.severity}</Badge>
          <Badge variant={incident.status === 'resolved' ? 'success' : 'warning'}>{incident.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {incident.reference} · Started {incident.started_at ? formatDateTime(incident.started_at) : '—'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader><CardTitle>Incident timeline</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {events.length ? events.map((event) => (
              <div key={event.id} className="border-l-2 border-border pl-4">
                <p className="text-sm font-medium text-foreground">{event.event_type?.replace(/_/g, ' ')}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {event.message || 'No message'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.created_at ? formatDateTime(event.created_at) : '—'}
                </p>
              </div>
            )) : <p className="text-sm text-muted-foreground">No timeline events recorded.</p>}

            {incident.status !== 'resolved' ? (
              <form
                className="grid gap-2 border-t border-border pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (eventMessage.trim()) eventMutation.mutate();
                }}
              >
                <label className="text-sm font-medium" htmlFor="incident-event">Add timeline update</label>
                <textarea
                  id="incident-event"
                  className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={eventMessage}
                  onChange={(event) => setEventMessage(event.target.value)}
                  maxLength={2000}
                  required
                />
                <Button type="submit" className="justify-self-start" disabled={busy}>Add update</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><CardTitle>Incident details</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-muted-foreground">{incident.summary}</p>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Affected services</p>
                <p className="mt-1">{incident.affected_services?.join(', ') || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Affected features</p>
                <p className="mt-1">{incident.affected_features?.join(', ') || 'Not specified'}</p>
              </div>
            </CardContent>
          </Card>

          {incident.status !== 'resolved' ? (
            <Card>
              <CardHeader><CardTitle>Update status</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (status && status !== incident.status) updateMutation.mutate();
                  }}
                >
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="investigating">Investigating</option>
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                  </select>
                  <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    placeholder="Reason for the status change"
                  />
                  <Button type="submit" disabled={busy || status === incident.status}>Save status</Button>
                </form>
                <form
                  className="mt-5 grid gap-3 border-t border-border pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    resolveMutation.mutate();
                  }}
                >
                  <label className="text-sm font-medium" htmlFor="resolution-summary">Resolution summary</label>
                  <textarea
                    id="resolution-summary"
                    className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={resolutionSummary}
                    onChange={(event) => setResolutionSummary(event.target.value)}
                    minLength={10}
                    maxLength={2000}
                    placeholder="Optional summary of the resolution"
                  />
                  <Button type="submit" variant="outline" disabled={busy}>Resolve incident</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

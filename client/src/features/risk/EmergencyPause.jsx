import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { AlertOctagon, ArrowLeft, CheckCircle2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { EmergencyPauseButton } from './components/EmergencyPauseButton.jsx';
import { useEmergencyPause } from '../../hooks/useRisk.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function EmergencyPause() {
  const dispatch = useDispatch();
  const toast = useToast();
  const emergency = useEmergencyPause();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Emergency Pause'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Risk', path: ROUTES.app.risk.overview },
        { label: 'Emergency pause', path: ROUTES.app.risk.emergency },
      ]),
    );
  }, [dispatch]);

  const handleRequest = async (payload) => {
    try {
      await emergency.requestPause(payload);
      toast.success('Emergency pause requested');
    } catch (err) {
      toast.error('Failed to request pause', { description: getErrorMessage(err) });
      throw err;
    }
  };

  const handleResume = async () => {
    if (!emergency.status?.id) {
      return;
    }
    try {
      await emergency.resume({ pauseId: emergency.status.id, reason: 'Resolved' });
      toast.success('Pause lifted');
    } catch (err) {
      toast.error('Failed to resume', { description: getErrorMessage(err) });
    }
  };

  if (emergency.isLoading) {
    return <LoadingState label="Loading emergency status" />;
  }

  const status = emergency.status;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.risk.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Emergency Pause
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stop new eligible live dispatches across a defined scope. Existing exchange orders
            and positions remain in force until separately managed.
          </p>
        </div>
        {!status?.isActive ? (
          <EmergencyPauseButton
            onRequestPause={handleRequest}
            isSubmitting={emergency.isLoading}
            scopeOptions={status?.scopeOptions ?? {}}
          />
        ) : null}
      </div>

      {status?.isActive ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertOctagon className="mt-0.5 h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-destructive">Pause active</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Scope: {status.scope ?? '—'} · Target: {status.targetId ?? 'all'}
                  </p>
                </div>
              </div>
              <Badge variant="destructive">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field
              label="Requested"
              value={status.requestedAt ? formatDateTime(status.requestedAt) : '—'}
            />
            <Field label="Requested by" value={status.requestedBy ?? '—'} />
            <Field label="Reason" value={status.reason ?? '—'} />
          </CardContent>
          <CardContent>
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleResume}>
                <CheckCircle2 className="h-4 w-4" />
                Request resumption
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground">No active pause</p>
            <p className="max-w-md text-xs text-muted-foreground">
              New eligible dispatches are operating normally. Use the emergency pause button to
              stop new dispatches if an incident requires containment.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent pause events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {status?.history?.length > 0 ? (
            <ul className="divide-y divide-border">
              {status.history.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {event.action ?? event.type}
                    </p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {event.occurredAt ? formatDateTime(event.occurredAt) : ''}
                      {event.scope ? ` · ${event.scope}` : ''}
                    </p>
                  </div>
                  <Badge variant={event.action === 'pause_activated' ? 'destructive' : 'success'}>
                    {event.action?.replace(/_/g, ' ') ?? '—'}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">No pause history.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, FlaskConical, KeyRound, Webhook } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { CopyButton } from '../../components/ui/CopyButton.jsx';
import { useDeveloperApplication } from '../../hooks/useDeveloper.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function ApplicationDetails() {
  const { applicationId } = useParams();
  const dispatch = useDispatch();
  const appQuery = useDeveloperApplication(applicationId);

  const { application, credentials, webhooks, isLoading, error } = appQuery;

  useEffect(() => {
    if (application) {
      dispatch(uiActions.setPageTitle(application.name));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Developer', path: ROUTES.app.developer.overview },
          {
            label: 'Applications',
            path: ROUTES.app.developer.applications,
          },
          {
            label: application.name,
            path: ROUTES.app.developer.application(application.id),
          },
        ]),
      );
    }
  }, [application, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading application" />;
  }

  if (error || !application) {
    return (
      <ErrorState
        title="Unable to load application"
        description="This application could not be retrieved."
        onRetry={appQuery.refetch}
      />
    );
  }

  const isActive = application.status === 'active';
  const isSuspended = application.status === 'suspended';
  const isRestricted = application.status === 'restricted';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.developer.applications}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {application.name}
            </h1>
            <Badge
              variant={
                isActive
                  ? 'success'
                  : isSuspended
                    ? 'destructive'
                    : isRestricted
                      ? 'warning'
                      : 'muted'
              }
            >
              {application.status ?? 'draft'}
            </Badge>
            {application.environment ? (
              <Badge variant="muted">{application.environment}</Badge>
            ) : null}
          </div>
          {application.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{application.description}</p>
          ) : null}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-2xs text-muted-foreground">
              {application.id}
            </span>
            <CopyButton value={application.id} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          to={ROUTES.app.developer.credentials(application.id)}
          icon={KeyRound}
          label="Credentials"
          value={`${credentials.length} active`}
        />
        <QuickLink
          to={ROUTES.app.developer.webhooks(application.id)}
          icon={Webhook}
          label="Webhooks"
          value={`${webhooks.length} subscriptions`}
        />
        <QuickLink
          to={ROUTES.app.developer.usage(application.id)}
          icon={BarChart3}
          label="Usage"
          value="View analytics"
        />
        <QuickLink
          to={ROUTES.app.developer.sandbox(application.id)}
          icon={FlaskConical}
          label="Sandbox"
          value="Test integrations"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Type" value={application.type?.replace(/_/g, ' ') ?? '—'} />
          <Field label="Environment" value={application.environment ?? '—'} />
          <Field
            label="Owner"
            value={application.ownerName ?? application.ownerWorkspaceName ?? '—'}
          />
          <Field
            label="Created"
            value={
              application.createdAt ? formatDateTime(application.createdAt) : '—'
            }
          />
          <Field label="Contact email" value={application.contactEmail ?? '—'} />
          <Field label="Website" value={application.website ?? '—'} />
          <Field
            label="Last activity"
            value={
              application.lastActivityAt
                ? formatDateTime(application.lastActivityAt)
                : '—'
            }
          />
          <Field
            label="Last security review"
            value={
              application.lastSecurityReviewAt
                ? formatDateTime(application.lastSecurityReviewAt)
                : '—'
            }
          />
        </CardContent>
      </Card>

      {application.redirectUris?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Approved redirect URIs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {application.redirectUris.map((uri) => (
                <li
                  key={uri}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <code className="truncate font-mono text-xs text-foreground">
                    {uri}
                  </code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, value }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </Link>
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
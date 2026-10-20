import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Circle, ExternalLink } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { workspacesApi } from '../../api/index.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceSettings() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const { workspaces, updateWorkspace, switchWorkspace } = useWorkspaceContext();

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.workspaces.capabilities(workspaceId),
    queryFn: () => workspacesApi.getCapabilities(workspaceId),
    enabled: Boolean(workspace),
  });

  const [form, setForm] = useState({
    name: workspace?.name ?? '',
    description: workspace?.description ?? '',
    timezone: workspace?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    preferredLanguage: workspace?.preferredLanguage ?? 'en',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace) {
      setForm({
        name: workspace.name ?? '',
        description: workspace.description ?? '',
        timezone: workspace.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        preferredLanguage: workspace.preferredLanguage ?? 'en',
      });
      dispatch(uiActions.setPageTitle(`${workspace.name} · Settings`));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Settings', path: ROUTES.app.settings.profile },
          { label: 'Workspaces', path: ROUTES.app.settings.workspaces },
          {
            label: workspace.name,
            path: ROUTES.app.settings.workspace(workspace.id),
          },
        ]),
      );
    }
  }, [workspace, dispatch]);

  if (!workspace) {
    return (
      <ErrorState
        title="Workspace not found"
        description="This workspace could not be found."
      />
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWorkspace({ workspaceId, ...form });
      toast.success('Workspace updated');
    } catch (err) {
      toast.error('Save failed', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const openWorkspaceFeature = async (path) => {
    try {
      await switchWorkspace(workspace.id);
      navigate(path);
    } catch (err) {
      toast.error('Could not switch workspace', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.settings.workspaces}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {workspace.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {`${workspace.type[0].toUpperCase()}${workspace.type.slice(1)} workspace`}
        </p>
      </div>

      {workspace.type === 'trader' || workspace.type === 'developer' ? (
        <Card>
          <CardHeader>
            <CardTitle>{workspace.type === 'trader' ? 'Trader onboarding' : 'Developer onboarding'}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {workspace.type === 'trader' ? (
              <>
                <OnboardingLink
                  label="Complete your Trader profile"
                  onClick={() => openWorkspaceFeature(ROUTES.app.marketplace.traderProfile)}
                />
                <p className="text-sm text-muted-foreground">
                  Review your public profile and marketplace eligibility before enabling visibility.
                </p>
              </>
            ) : (
              <>
                <OnboardingLink
                  label="Create your first application"
                  onClick={() => openWorkspaceFeature(ROUTES.app.developer.applications)}
                />
                <p className="text-sm text-muted-foreground">
                  Applications start in the sandbox. Production credentials require separate
                  entitlement and authorization.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Capabilities and entitlements</CardTitle>
        </CardHeader>
        <CardContent>
          {capabilitiesQuery.isLoading ? (
            <LoadingState />
          ) : capabilitiesQuery.error ? (
            <ErrorState
              title="Capabilities unavailable"
              description={getErrorMessage(capabilitiesQuery.error)}
            />
          ) : (
            <div className="divide-y divide-border">
              {capabilitiesQuery.data?.capabilities?.map((capability) => (
                <div key={capability.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium capitalize text-foreground">
                      {capability.key.replaceAll('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {capability.entitlement
                        ? `${capability.entitlement}${capability.limit !== null ? ` · limit ${capability.limit}` : ''}`
                        : 'Included with this workspace type'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${capability.enabled ? 'text-success' : 'text-muted-foreground'}`}>
                    {capability.status.replaceAll('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Workspace name" htmlFor="ws-name" required>
            <Input
              id="ws-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={workspace.type === 'personal'}
            />
          </FormField>

          <FormField label="Description" htmlFor="ws-description">
            <Textarea
              id="ws-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Timezone" htmlFor="ws-timezone">
              <Input
                id="ws-timezone"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </FormField>
            <FormField label="Default language" htmlFor="ws-language">
              <Input
                id="ws-language"
                value={form.preferredLanguage}
                onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
              />
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || workspace.type === 'personal'}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NavCard to={ROUTES.app.settings.workspaceMembers(workspaceId)} label="Members" />
        <NavCard to={ROUTES.app.settings.workspaceInvitations(workspaceId)} label="Invitations" />
        <NavCard to={ROUTES.app.settings.workspaceRoles(workspaceId)} label="Roles" />
        <NavCard to={ROUTES.app.settings.workspaceShares(workspaceId)} label="Connection shares" />
        <NavCard to={ROUTES.app.settings.workspaceOwnership(workspaceId)} label="Ownership" />
        <NavCard to={ROUTES.app.settings.workspaceAudit(workspaceId)} label="Audit history" />
      </div>
    </div>
  );
}

function OnboardingLink({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm font-medium text-foreground hover:border-primary/40"
    >
      <span className="flex items-center gap-2">
        <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {label}
      </span>
      <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function NavCard({ to, label }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border bg-card p-4 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/40"
    >
      {label}
    </Link>
  );
}
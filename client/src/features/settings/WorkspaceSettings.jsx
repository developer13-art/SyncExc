import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceSettings() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const { workspaces, updateWorkspace } = useWorkspaceContext();

  const workspace = workspaces.find((w) => w.id === workspaceId);

  const [form, setForm] = useState({
    name: workspace?.name ?? '',
    description: workspace?.description ?? '',
    timezone: workspace?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    defaultLanguage: workspace?.defaultLanguage ?? 'en',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace) {
      setForm({
        name: workspace.name ?? '',
        description: workspace.description ?? '',
        timezone: workspace.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        defaultLanguage: workspace.defaultLanguage ?? 'en',
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
          {workspace.type === 'organization' ? 'Organization workspace' : 'Personal workspace'}
        </p>
      </div>

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
                value={form.defaultLanguage}
                onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}
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
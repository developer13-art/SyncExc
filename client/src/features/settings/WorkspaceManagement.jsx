import { useEffect, useState } from 'react';
import { Archive, BriefcaseBusiness, Code2, Plus, RotateCcw, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { workspacesApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const TYPE_OPTIONS = [
  { value: 'trader', label: 'Trader', detail: 'Manage trading profiles, signals and source execution.' },
  { value: 'developer', label: 'Developer', detail: 'Build and test integrations in an isolated workspace.' },
];

const typeIcons = {
  personal: UserRound,
  organization: BriefcaseBusiness,
  trader: BriefcaseBusiness,
  developer: Code2,
};

const typeLabels = {
  personal: 'Personal',
  organization: 'Organization',
  trader: 'Trader',
  developer: 'Developer',
};

export default function WorkspaceManagement() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { workspaces, activeWorkspace, createWorkspace, switchWorkspace, isCreating } =
    useWorkspaceContext();
  const [type, setType] = useState('trader');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busyWorkspaceId, setBusyWorkspaceId] = useState(null);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Workspaces'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Settings', path: ROUTES.app.settings.profile },
      { label: 'Workspaces', path: ROUTES.app.settings.workspaces },
    ]));
  }, [dispatch]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const workspace = await createWorkspace({ type, name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      toast.success(`${typeLabels[workspace.type] ?? 'Workspace'} created`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      if (workspace.id) await switchWorkspace(workspace.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleLifecycle = async (workspace, status) => {
    setBusyWorkspaceId(workspace.id);
    try {
      if (activeWorkspace?.id === workspace.id) {
        const personal = workspaces.find((item) => item.type === 'personal' && item.status === 'active');
        if (personal) await switchWorkspace(personal.id);
      }
      await workspacesApi.updateLifecycle(workspace.id, {
        status,
        reason: status === 'archived' ? 'Archived by workspace owner' : 'Updated by workspace owner',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      toast.success(status === 'archived' ? 'Workspace archived' : 'Workspace resumed');
    } catch (err) {
      toast.error('Workspace update failed', { description: getErrorMessage(err) });
    } finally {
      setBusyWorkspaceId(null);
    }
  };

  const visibleWorkspaces = [...workspaces].sort((a, b) => {
    const order = { personal: 0, trader: 1, developer: 2, organization: 3 };
    return (order[a.type] ?? 4) - (order[b.type] ?? 4) || a.name.localeCompare(b.name);
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspaces</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Keep personal, trading and development work separate. Switching workspaces changes the
          active data context; it does not share credentials or upgrade your plan.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Create a workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={type === option.value}
                  onClick={() => setType(option.value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    type === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium text-foreground">{option.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{option.detail}</span>
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={type === 'trader' ? 'My trading desk' : 'My developer lab'}
                  maxLength={100}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="workspace-description">Description (optional)</Label>
                <Input
                  id="workspace-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What this workspace is for"
                  maxLength={500}
                />
              </div>
            </div>

            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Creation is limited by your plan entitlements. This action will not change your plan.
              </p>
              <Button type="submit" disabled={isCreating || !name.trim()}>
                <Plus className="h-4 w-4" />
                {isCreating ? 'Creating…' : `Create ${typeLabels[type]} workspace`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="workspace-list-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="workspace-list-title" className="text-lg font-semibold text-foreground">
            Your workspaces
          </h2>
          <span className="text-sm text-muted-foreground">{visibleWorkspaces.length} total</span>
        </div>
        <div className="grid gap-3">
          {visibleWorkspaces.map((workspace) => {
            const Icon = typeIcons[workspace.type] ?? BriefcaseBusiness;
            const archived = workspace.status === 'archived';
            const active = activeWorkspace?.id === workspace.id;
            return (
              <Card key={workspace.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground">{workspace.name}</p>
                        <Badge variant="secondary">{typeLabels[workspace.type] ?? workspace.type}</Badge>
                        <Badge variant={workspace.status === 'active' ? 'success' : 'outline'}>
                          {workspace.status}
                        </Badge>
                        {active ? <Badge>Current</Badge> : null}
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {workspace.description || (workspace.type === 'personal'
                          ? 'Private account workspace'
                          : 'Private by default')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {workspace.type !== 'personal' && !archived ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={ROUTES.app.settings.workspace(workspace.id)}>Settings</Link>
                      </Button>
                    ) : null}
                    {!active && workspace.status === 'active' ? (
                      <Button size="sm" variant="outline" onClick={() => switchWorkspace(workspace.id)}>
                        Switch
                      </Button>
                    ) : null}
                    {workspace.type !== 'personal' && workspace.status === 'active' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyWorkspaceId === workspace.id}
                          onClick={() => handleLifecycle(workspace, 'paused')}
                        >
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyWorkspaceId === workspace.id}
                          onClick={() => handleLifecycle(workspace, 'archived')}
                          aria-label={`Archive ${workspace.name}`}
                        >
                          <Archive className="h-4 w-4" />
                          Archive
                        </Button>
                      </>
                    ) : workspace.status === 'paused' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyWorkspaceId === workspace.id}
                          onClick={() => handleLifecycle(workspace, 'active')}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Resume
                        </Button>
                        {workspace.type !== 'personal' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyWorkspaceId === workspace.id}
                            onClick={() => handleLifecycle(workspace, 'archived')}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {visibleWorkspaces.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Your workspace list is loading or not available yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

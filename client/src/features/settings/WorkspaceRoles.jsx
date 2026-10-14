import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Shield } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { RoleEditor } from './components/RoleEditor.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceRoles() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [availablePermissions, setAvailablePermissions] = useState([]);

  const rolesQuery = useQuery({
    queryKey: queryKeys.workspaces.roles(workspaceId),
    queryFn: () => workspacesApi.listRoles(workspaceId),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Roles'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Workspaces', path: ROUTES.app.settings.workspaces },
        { label: 'Roles', path: ROUTES.app.settings.workspaceRoles(workspaceId) },
      ]),
    );

    // Fetch available permissions once per workspace.
    fetch(`/api/v1/workspaces/${workspaceId}/permissions/catalog`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((payload) => setAvailablePermissions(payload?.data ?? []))
      .catch(() => setAvailablePermissions([]));
  }, [dispatch, workspaceId]);

  const createMutation = useMutation({
    mutationFn: (payload) => workspacesApi.createRole(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.roles(workspaceId) });
      toast.success('Role created');
    },
    onError: (err) =>
      toast.error('Failed to create role', { description: getErrorMessage(err) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, ...payload }) =>
      workspacesApi.updateRole(workspaceId, roleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.roles(workspaceId) });
      toast.success('Role updated');
    },
    onError: (err) =>
      toast.error('Failed to update role', { description: getErrorMessage(err) }),
  });

  const roles = rolesQuery.data ?? [];

  const handleOpenEditor = (role = null) => {
    setEditingRole(role);
    setEditorOpen(true);
  };

  const handleSubmit = async (values) => {
    if (editingRole) {
      await updateMutation.mutateAsync({ roleId: editingRole.id, ...values });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.settings.workspace(workspaceId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles group granular permissions. Platform-wide security restrictions always apply
            on top of any role.
          </p>
        </div>
        <Button onClick={() => handleOpenEditor(null)}>
          <Plus className="h-4 w-4" /> New role
        </Button>
      </div>

      {rolesQuery.isLoading ? (
        <LoadingState label="Loading roles" />
      ) : roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No roles yet"
          description="Create a role to define what members can do in this workspace."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardContent className="p-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {role.name}
                      </p>
                      {role.isSystem ? (
                        <Badge variant="muted" size="sm">
                          System
                        </Badge>
                      ) : null}
                    </div>
                    {role.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {role.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(role.permissions ?? []).slice(0, 4).map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full border border-border bg-muted/30 px-2 py-0.5 font-mono text-2xs text-muted-foreground"
                    >
                      {permission}
                    </span>
                  ))}
                  {(role.permissions?.length ?? 0) > 4 ? (
                    <span className="text-2xs text-muted-foreground">
                      +{role.permissions.length - 4} more
                    </span>
                  ) : null}
                </div>

                {!role.isSystem ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditor(role)}
                    >
                      Edit role
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RoleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        role={editingRole}
        permissions={availablePermissions}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
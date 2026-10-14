import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { PermissionMatrix } from './PermissionMatrix.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { rolesApi } from '../../api/index.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

export default function RoleEditor() {
  const { roleId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const isNew = !roleId || roleId === 'new';

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'admin',
    permissions: [],
  });
  const [error, setError] = useState(null);

  const roleQuery = useQuery({
    queryKey: ['role', roleId],
    queryFn: () => rolesApi.get(roleId),
    enabled: !isNew,
  });

  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesApi.permissions(),
  });

  useEffect(() => {
    if (isNew) {
      dispatch(adminUiActions.setPageTitle('Create Role'));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Roles', path: '/roles' },
          { label: 'New', path: '/roles/new' },
        ]),
      );
    } else if (roleQuery.data) {
      const role = roleQuery.data;
      setForm({
        name: role.name ?? '',
        description: role.description ?? '',
        category: role.category ?? 'admin',
        permissions: role.permissions ?? [],
      });
      dispatch(adminUiActions.setPageTitle(role.name));
      dispatch(
        adminUiActions.setBreadcrumbs([
          { label: 'Roles', path: '/roles' },
          { label: role.name, path: `/roles/${roleId}` },
        ]),
      );
    }
  }, [isNew, roleQuery.data, dispatch, roleId]);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isNew ? rolesApi.create(payload) : rolesApi.update(roleId, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(isNew ? 'Role created' : 'Role updated');
      if (isNew) {
        navigate(`/roles/${result.id}`, { replace: true });
      }
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  if (!isNew && roleQuery.isLoading) {
    return <LoadingState label="Loading role" />;
  }

  if (!isNew && (roleQuery.error || !roleQuery.data)) {
    return (
      <ErrorState
        title="Unable to load role"
        description="This administrative role could not be retrieved."
        onRetry={roleQuery.refetch}
      />
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Role name is required');
      return;
    }
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      permissions: form.permissions,
    });
  };

  const handleTogglePermission = (permissionKey) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionKey)
        ? prev.permissions.filter((p) => p !== permissionKey)
        : [...prev.permissions, permissionKey],
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/roles">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {isNew ? 'Create administrative role' : `Edit · ${form.name}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles group granular permissions. The console denies access by default and never
          relies on UI visibility as a security boundary.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          <FormError>{error}</FormError>

          <Card>
            <CardHeader>
              <CardTitle>Role details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField label="Name" htmlFor="role-name" required>
                <Input
                  id="role-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormField>

              <FormField label="Description" htmlFor="role-description">
                <Textarea
                  id="role-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>

              <FormField label="Category" htmlFor="role-category">
                <Input
                  id="role-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </FormField>
            </CardContent>
          </Card>

          {permissionsQuery.data ? (
            <PermissionMatrix
              permissions={permissionsQuery.data}
              selected={form.permissions}
              onToggle={handleTogglePermission}
            />
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/roles">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
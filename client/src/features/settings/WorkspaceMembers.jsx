import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { MemberTable } from './components/MemberTable.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceMembers() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId, {}),
    queryFn: () => workspacesApi.listMembers(workspaceId, {}),
    enabled: Boolean(workspaceId),
  });

  const rolesQuery = useQuery({
    queryKey: queryKeys.workspaces.roles(workspaceId),
    queryFn: () => workspacesApi.listRoles(workspaceId),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Members'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Workspaces', path: ROUTES.app.settings.workspaces },
        { label: 'Members', path: ROUTES.app.settings.workspaceMembers(workspaceId) },
      ]),
    );
  }, [dispatch, workspaceId]);

  const handleSuspend = async (member) => {
    try {
      await workspacesApi.suspendMember(workspaceId, member.userId ?? member.id);
      toast.success('Member suspended');
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId, {}) });
    } catch (err) {
      toast.error('Suspend failed', { description: getErrorMessage(err) });
    }
  };

  const handleRestore = async (member) => {
    try {
      await workspacesApi.restoreMember(workspaceId, member.userId ?? member.id);
      toast.success('Member restored');
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId, {}) });
    } catch (err) {
      toast.error('Restore failed', { description: getErrorMessage(err) });
    }
  };

  const handleRemove = async (member) => {
    try {
      await workspacesApi.removeMember(workspaceId, member.userId ?? member.id);
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId, {}) });
    } catch (err) {
      toast.error('Remove failed', { description: getErrorMessage(err) });
    }
  };

  const handleChangeRole = () => {
    toast.info('Role change', {
      description: 'Open the role editor from the member row to change a role.',
    });
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

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage who has access to this workspace and their roles.
        </p>
      </div>

      {membersQuery.isLoading ? (
        <LoadingState label="Loading members" />
      ) : (
        <Card>
          <CardContent className="p-5 pt-5">
            <MemberTable
              members={membersQuery.data?.items ?? []}
              roles={rolesQuery.data ?? []}
              isLoading={membersQuery.isLoading}
              onChangeRole={handleChangeRole}
              onSuspend={handleSuspend}
              onRestore={handleRestore}
              onRemove={handleRemove}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
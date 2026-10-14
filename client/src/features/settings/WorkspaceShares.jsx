import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ShareGrantTable } from './components/ShareGrantTable.jsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function WorkspaceShares() {
  const { workspaceId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const sharesQuery = useQuery({
    queryKey: queryKeys.workspaces.shares(workspaceId, {}),
    queryFn: () => workspacesApi.listConnectionShares(workspaceId, {}),
    enabled: Boolean(workspaceId),
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId) => workspacesApi.revokeConnectionShare(workspaceId, grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.shares(workspaceId, {}),
      });
      toast.success('Share grant revoked');
    },
    onError: (err) =>
      toast.error('Revocation failed', { description: getErrorMessage(err) }),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Connection Shares'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Settings', path: ROUTES.app.settings.profile },
        { label: 'Workspaces', path: ROUTES.app.settings.workspaces },
        {
          label: 'Connection shares',
          path: ROUTES.app.settings.workspaceShares(workspaceId),
        },
      ]),
    );
  }, [dispatch, workspaceId]);

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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Connection Shares
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explicit grants that allow this workspace to use a connection for defined operations.
          Revocation takes effect immediately in APIs, workers, and real-time streams.
        </p>
      </div>

      {sharesQuery.isLoading ? (
        <LoadingState label="Loading shares" />
      ) : (
        <ShareGrantTable
          grants={sharesQuery.data?.items ?? []}
          onRevoke={(grant) => revokeMutation.mutateAsync(grant.id)}
          isRevoking={revokeMutation.isPending}
        />
      )}

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Sharing a connection never transfers ownership. Revoking a grant does not delete the
          underlying connection or expose credentials to the recipient workspace.
        </CardContent>
      </Card>
    </div>
  );
}
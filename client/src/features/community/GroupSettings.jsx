import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { communityApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function GroupSettings() {
  const { groupId } = useParams();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const groupQuery = useQuery({
    queryKey: queryKeys.community.group(groupId),
    queryFn: () => communityApi.getGroup(groupId),
    enabled: Boolean(groupId),
  });
  const group = groupQuery.data;
  const canEdit = ['owner', 'administrator'].includes(group?.viewerRole);

  const membersQuery = useQuery({
    queryKey: [...queryKeys.community.group(groupId), 'members'],
    queryFn: () => communityApi.listGroupMembers(groupId),
    enabled: Boolean(groupId) && Boolean(group?.viewerIsModerator),
  });
  const requestsQuery = useQuery({
    queryKey: [...queryKeys.community.group(groupId), 'requests'],
    queryFn: () => communityApi.listGroupRequests(groupId),
    enabled: Boolean(groupId) && Boolean(group?.viewerIsModerator),
  });

  useEffect(() => {
    if (!group) return;
    setName(group.name ?? '');
    setDescription(group.description ?? '');
    dispatch(uiActions.setPageTitle(`${group.name} settings`));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Community', path: ROUTES.app.community.overview },
      { label: 'Groups', path: ROUTES.app.community.groups },
      { label: group.name, path: ROUTES.app.community.group(groupId) },
      { label: 'Settings', path: ROUTES.app.community.groupSettings(groupId) },
    ]));
  }, [group, dispatch, groupId]);

  const invalidateGroupData = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.community.group(groupId) });
    await queryClient.invalidateQueries({ queryKey: [...queryKeys.community.group(groupId), 'members'] });
    await queryClient.invalidateQueries({ queryKey: [...queryKeys.community.group(groupId), 'requests'] });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await communityApi.updateGroup(groupId, { name: name.trim(), description: description.trim() });
      await invalidateGroupData();
      toast.success('Group settings updated');
    } catch (error) {
      toast.error('Could not update settings', { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleRequest = async (userId, approved) => {
    try {
      await communityApi.resolveGroupRequest(groupId, userId, approved);
      await invalidateGroupData();
      toast.success(approved ? 'Member approved' : 'Request declined');
    } catch (error) {
      toast.error('Could not update request', { description: getErrorMessage(error) });
    }
  };

  const handleRole = async (userId, role) => {
    try {
      await communityApi.setGroupMemberRole(groupId, userId, role);
      await invalidateGroupData();
      toast.success('Member role updated');
    } catch (error) {
      toast.error('Could not update role', { description: getErrorMessage(error) });
    }
  };

  const handleRemove = async (userId) => {
    try {
      await communityApi.removeGroupMember(groupId, userId);
      await invalidateGroupData();
      toast.success('Member removed');
    } catch (error) {
      toast.error('Could not remove member', { description: getErrorMessage(error) });
    }
  };

  if (groupQuery.isLoading) return <LoadingState label="Loading group settings" />;
  if (groupQuery.isError || !group) {
    return (
      <ErrorState
        title="Unable to load group settings"
        description="You may not have permission to manage this group."
        onRetry={groupQuery.refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link to={ROUTES.app.community.group(groupId)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to group
        </Link>
      </Button>

      {canEdit ? (
        <Card>
          <CardHeader><CardTitle>Group details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} aria-label="Group name" />
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} aria-label="Group description" />
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {group.viewerIsModerator ? (
        <>
          <Card>
            <CardHeader><CardTitle>Join requests</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {requestsQuery.isLoading ? <LoadingState label="Loading requests" /> : null}
              {requestsQuery.isError ? (
                <ErrorState title="Unable to load requests" description="Try again." onRetry={requestsQuery.refetch} />
              ) : null}
              {(requestsQuery.data?.items ?? []).map((request) => (
                <div key={request.user_id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                  <span className="flex-1 text-sm font-medium">{request.display_name} @{request.handle}</span>
                  <Button size="sm" onClick={() => handleRequest(request.user_id, true)} aria-label={`Approve ${request.handle}`}>
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRequest(request.user_id, false)} aria-label={`Decline ${request.handle}`}>
                    <X className="mr-1 h-4 w-4" /> Decline
                  </Button>
                </div>
              ))}
              {!requestsQuery.isLoading && !requestsQuery.isError && (requestsQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Members</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {membersQuery.isLoading ? <LoadingState label="Loading members" /> : null}
              {membersQuery.isError ? (
                <ErrorState title="Unable to load members" description="Try again." onRetry={membersQuery.refetch} />
              ) : null}
              {(membersQuery.data?.items ?? []).map((member) => (
                <div key={member.user_id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                  <span className="flex-1 text-sm font-medium">{member.display_name} @{member.handle}</span>
                  {canEdit && member.user_id !== group.ownerId ? (
                    <>
                      <Select value={member.role ?? 'member'} onValueChange={(role) => handleRole(member.user_id, role)}>
                        <SelectTrigger className="w-36" aria-label={`Role for ${member.handle}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="administrator">Administrator</SelectItem>
                          <SelectItem value="read_only">Read only</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => handleRemove(member.user_id)}>Remove</Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{member.role ?? 'member'}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

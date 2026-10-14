import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Settings, Users } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { PostCard } from './components/PostCard.jsx';
import { useQuery } from '@tanstack/react-query';
import { communityApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useCommunityGroups, useCommunityPosts } from '../../hooks/useCommunity.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function GroupDetails() {
  const { groupId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const groupQuery = useQuery({
    queryKey: queryKeys.community.group(groupId),
    queryFn: () => communityApi.getGroup(groupId),
    enabled: Boolean(groupId),
  });

  const postsQuery = useCommunityPosts({ groupId });

  useEffect(() => {
    if (groupQuery.data) {
      dispatch(uiActions.setPageTitle(groupQuery.data.name));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Community', path: ROUTES.app.community.overview },
          { label: 'Groups', path: ROUTES.app.community.groups },
          {
            label: groupQuery.data.name,
            path: ROUTES.app.community.group(groupId),
          },
        ]),
      );
    }
  }, [groupQuery.data, dispatch, groupId]);

  if (groupQuery.isLoading) {
    return <LoadingState label="Loading group" />;
  }

  if (groupQuery.error || !groupQuery.data) {
    return (
      <ErrorState
        title="Unable to load group"
        description="This group could not be retrieved."
        onRetry={groupQuery.refetch}
      />
    );
  }

  const group = groupQuery.data;

  const handleJoin = async () => {
    try {
      await communityApi.joinGroup(groupId, {});
      toast.success('Joined group');
      groupQuery.refetch();
    } catch (err) {
      toast.error('Join failed', { description: getErrorMessage(err) });
    }
  };

  const handleLeave = async () => {
    try {
      await communityApi.leaveGroup(groupId);
      toast.success('Left group');
      groupQuery.refetch();
    } catch (err) {
      toast.error('Leave failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.community.groups}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {group.name}
                </h1>
                <Badge variant="muted">{group.visibility}</Badge>
              </div>
              {group.description ? (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {group.description}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {group.memberCount?.toLocaleString() ?? 0}{' '}
                  members
                </span>
                {group.topics?.length > 0
                  ? group.topics.map((topic) => (
                      <Badge key={topic} variant="muted" size="sm">
                        #{topic}
                      </Badge>
                    ))
                  : null}
              </div>
            </div>

            <div className="flex gap-2">
              {group.viewerIsMember ? (
                <>
                  <Button variant="outline" onClick={handleLeave}>
                    Leave
                  </Button>
                  {group.viewerIsModerator ? (
                    <Button variant="outline" asChild>
                      <Link to={ROUTES.app.community.groupSettings(group.id)}>
                        <Settings className="h-4 w-4" /> Settings
                      </Link>
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button onClick={handleJoin}>Join group</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>
        <TabsContent value="posts">
          {(postsQuery.posts ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No posts in this group yet.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {postsQuery.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="members">
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Member list is available to group members.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="about">
          <Card>
            <CardContent className="flex flex-col gap-3 p-5 pt-5 text-sm">
              <p className="text-muted-foreground">
                Group roles are separate from workspace and trading permissions. Participating
                in a group never grants access to another member's data or exchange connections.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
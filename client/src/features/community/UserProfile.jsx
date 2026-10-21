import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { ProfileHeader } from './components/ProfileHeader.jsx';
import { PostCard } from './components/PostCard.jsx';
import { useQuery } from '@tanstack/react-query';
import { communityApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function UserProfile() {
  const { userId } = useParams();
  const dispatch = useDispatch();

  const profileQuery = useQuery({
    queryKey: queryKeys.community.profile(userId),
    queryFn: () => communityApi.getProfile(userId),
    enabled: Boolean(userId),
  });

  const postsQuery = useQuery({
    queryKey: queryKeys.community.profilePosts(userId, {}),
    queryFn: () => communityApi.getProfilePosts(userId, {}),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (profileQuery.data) {
      dispatch(uiActions.setPageTitle(profileQuery.data.displayName ?? 'Profile'));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Community', path: ROUTES.app.community.overview },
          {
            label: profileQuery.data.displayName ?? 'Profile',
            path: ROUTES.app.community.profile(userId),
          },
        ]),
      );
    }
  }, [profileQuery.data, dispatch, userId]);

  if (profileQuery.isLoading) {
    return <LoadingState label="Loading profile" />;
  }

  if (profileQuery.error || !profileQuery.data) {
    return (
      <ErrorState
        title="Unable to load profile"
        description="This profile could not be retrieved."
        onRetry={profileQuery.refetch}
      />
    );
  }

  const profile = profileQuery.data;
  const posts = postsQuery.data?.items ?? [];

  const handleFollow = async () => {
    await communityApi.follow(userId);
    profileQuery.refetch();
  };

  const handleUnfollow = async () => {
    await communityApi.unfollow(userId);
    profileQuery.refetch();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.community.discover}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <ProfileHeader
        profile={profile}
        isOwnProfile={false}
        isFollowing={profile.viewerIsFollowing}
        hasPendingFollowRequest={profile.viewerHasPendingFollowRequest}
        onFollow={handleFollow}
        onUnfollow={handleUnfollow}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Posts</h2>
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              This user hasn't posted yet.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
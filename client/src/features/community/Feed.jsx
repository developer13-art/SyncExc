import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { MessageSquare, Plus, Users } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { PostCard } from './components/PostCard.jsx';
import { PostComposer } from './components/PostComposer.jsx';
import { useCommunityFeed, useCommunityPosts, useCommunityProfile } from '../../hooks/useCommunity.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { communityApi } from '../../api/index.js';
import { ROUTES } from '../../config/routes.config.js';

const FEED_OPTIONS = [
  { value: 'following', label: 'Following' },
  { value: 'discover', label: 'Discover' },
  { value: 'latest', label: 'Latest' },
];

export default function Feed() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [tab, setTab] = useState('following');

  const profileQuery = useCommunityProfile();
  const feedQuery = useCommunityFeed({ following: tab === 'following' });
  const postsQuery = useCommunityPosts({ limit: 20 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Community'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
      ]),
    );
  }, [dispatch]);

  const posts =
    tab === 'following'
      ? (feedQuery.data?.items ?? [])
      : (postsQuery.posts ?? []);

  const handleCreatePost = async (values) => {
    try {
      await postsQuery.createPost(values);
      toast.success('Posted');
      await postsQuery.refetch?.();
    } catch (err) {
      toast.error('Failed to post', { description: getErrorMessage(err) });
      throw err;
    }
  };

  const handleReact = async (post) => {
    try {
      await communityApi.addReaction({ postId: post.id, type: 'like' });
      postsQuery.refetch?.();
    } catch (err) {
      toast.error('Reaction failed', { description: getErrorMessage(err) });
    }
  };

  const handleBookmark = async (post) => {
    try {
      if (post.viewerBookmarked) {
        await communityApi.removeSavedItem(post.bookmarkId);
      } else {
        await communityApi.saveItem({ postId: post.id });
      }
      postsQuery.refetch?.();
    } catch (err) {
      toast.error('Bookmark failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share analysis, discuss markets, and collaborate. Posts never trigger trades and
            community engagement is not a credibility or performance signal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.community.groups}>
              <Users className="h-4 w-4" /> Groups
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.community.discussions}>
              <MessageSquare className="h-4 w-4" /> Discussions
            </Link>
          </Button>
          <Button asChild>
            <Link to={ROUTES.app.community.createPost}>
              <Plus className="h-4 w-4" /> New post
            </Link>
          </Button>
        </div>
      </div>

      <PostComposer
        user={profileQuery.profile}
        defaultDestination="public"
        destinations={[
          { value: 'public', label: 'Public feed' },
          { value: 'workspace', label: 'Workspace (private)' },
        ]}
        onSubmit={handleCreatePost}
      />

      <SegmentedControl options={FEED_OPTIONS} value={tab} onChange={setTab} />

      {tab === 'following' && feedQuery.isLoading ? (
        <LoadingState label="Loading feed" />
      ) : tab === 'following' && feedQuery.isError ? (
        <ErrorState
          title="Unable to load feed"
          description="We could not fetch your feed."
          onRetry={feedQuery.refetch}
        />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={tab === 'following' ? 'Your feed is empty' : 'No posts yet'}
          description={
            tab === 'following'
              ? 'Follow other users or join groups to see their posts here.'
              : 'Be the first to post something.'
          }
          action={
            <Button asChild>
              <Link to={ROUTES.app.community.createPost}>Create post</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={profileQuery.profile?.userId}
              onReact={handleReact}
              onBookmark={handleBookmark}
            />
          ))}
        </div>
      )}
    </div>
  );
}
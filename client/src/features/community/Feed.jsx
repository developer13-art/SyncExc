import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Hash, MessageSquare, TrendingUp, Users } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { PostCard } from './components/PostCard.jsx';
import { PostComposer } from './components/PostComposer.jsx';
import { ReportDialog } from './components/ReportDialog.jsx';
import {
  useCommunityFeed,
  useCommunityGroups,
  useCommunityPosts,
  useCommunityProfile,
} from '../../hooks/useCommunity.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { communityApi } from '../../api/index.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Feed() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [tab, setTab] = useState('following');
  const [reportTarget, setReportTarget] = useState(null);

  const profileQuery = useCommunityProfile();
  const feedQuery = useCommunityFeed({ following: tab === 'following' });
  const postsQuery = useCommunityPosts({ limit: 20 });
  const groupsQuery = useCommunityGroups({ limit: 5 });

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
  const topicCounts = posts.reduce((counts, post) => {
    (post.topics ?? []).forEach((topic) => {
      const name = typeof topic === 'string' ? topic : topic?.name;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return counts;
  }, new Map());
  const trendingTopics = [...topicCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

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

  const submitReport = async ({ reason, details }) => {
    try {
      await communityApi.submitReport({
        resourceType: 'post',
        resourceId: reportTarget.id,
        reason,
        details,
      });
      toast.success('Report submitted');
      setReportTarget(null);
    } catch (err) {
      toast.error('Report failed', { description: getErrorMessage(err) });
      throw err;
    }
  };

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share analysis, discuss markets, and learn together.
          </p>
        </div>
        <PostComposer
          user={profileQuery.profile}
          defaultDestination="public"
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
                onReport={setReportTarget}
              />
            ))}
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardContent className="p-4 pt-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" /> Trending topics
            </h2>
            {trendingTopics.length ? (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {trendingTopics.map(([topic, count]) => (
                  <li key={topic}>
                    <Link
                      to={`${ROUTES.app.community.discover}?q=${encodeURIComponent(topic)}`}
                      className="flex items-center justify-between gap-2 py-2 text-sm hover:text-primary"
                    >
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{topic}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {count} {count === 1 ? 'post' : 'posts'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Topics will appear here as the community shares posts.
              </p>
            )}
            <Link
              to={ROUTES.app.community.discover}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Explore topics <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" /> Suggested groups
              </h2>
              <Link
                to={ROUTES.app.community.groups}
                className="text-xs font-medium text-primary hover:underline"
              >
                See all
              </Link>
            </div>
            {groupsQuery.groups.length ? (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {groupsQuery.groups.slice(0, 5).map((group) => (
                  <li key={group.id}>
                    <Link
                      to={ROUTES.app.community.group(group.id)}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {group.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {group.memberCount?.toLocaleString() ?? 0} members
                        </span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No groups to suggest yet.
              </p>
            )}
          </CardContent>
        </Card>
      </aside>
      <ReportDialog
        open={Boolean(reportTarget)}
        onOpenChange={(open) => { if (!open) setReportTarget(null); }}
        onSubmit={submitReport}
      />
    </div>
  );
}
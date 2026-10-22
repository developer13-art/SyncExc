import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Compass } from 'lucide-react';

import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { PostCard } from './components/PostCard.jsx';
import { GroupCard } from './components/GroupCard.jsx';
import { RecommendationCard } from './components/RecommendationCard.jsx';
import {
  useCommunitySearch,
  useCommunityGroups,
  useCommunityPosts,
} from '../../hooks/useCommunity.js';
import { communityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const DISCOVER_TABS = [
  { value: 'posts', label: 'Posts' },
  { value: 'groups', label: 'Groups' },
  { value: 'people', label: 'People' },
];

export default function Discover() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [tab, setTab] = useState('posts');
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Discover'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'Discover', path: ROUTES.app.community.discover },
      ]),
    );
  }, [dispatch]);

  const searchQuery = useCommunitySearch({
    q: query || undefined,
    type: tab === 'people' ? 'profiles' : tab,
  }, { enabled: tab === 'people' || Boolean(query) });
  const latestPostsQuery = useCommunityPosts({ limit: 20 });
  const groupsQuery = useCommunityGroups({ q: query || undefined });
  const isShowingLatestPosts = tab === 'posts' && !query;
  const isLoading =
    tab === 'posts'
      ? isShowingLatestPosts ? latestPostsQuery.isLoading : searchQuery.isLoading
      : tab === 'groups'
        ? groupsQuery.isLoading
        : searchQuery.isLoading;

  const handleFollow = async (profile) => {
    try {
      await communityApi.follow(profile.userId);
      toast.success('Following');
    } catch (error) {
      toast.error('Follow failed', { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Discover</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Find posts, groups, and people. Recommendations are explainable and controllable.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search…"
          className="w-full max-w-md"
        />
        <SegmentedControl options={DISCOVER_TABS} value={tab} onChange={setTab} />
      </div>

      {isLoading ? (
        <LoadingState label="Loading" />
      ) : tab === 'posts' ? (
        (isShowingLatestPosts ? latestPostsQuery.isError : searchQuery.isError) ? (
          <ErrorState
            title={isShowingLatestPosts ? 'Unable to load posts' : 'Search failed'}
            description="We could not load community posts."
            onRetry={isShowingLatestPosts ? latestPostsQuery.refetch : searchQuery.refetch}
          />
        ) : (isShowingLatestPosts
          ? latestPostsQuery.posts
          : searchQuery.data?.results?.posts ?? []).length === 0 ? (
          <EmptyState
            title={isShowingLatestPosts ? 'No posts yet' : 'No posts found'}
            description={isShowingLatestPosts
              ? 'Public community posts will appear here.'
              : 'Try a different search query.'}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {(isShowingLatestPosts
              ? latestPostsQuery.posts
              : searchQuery.data.results.posts).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )
      ) : tab === 'groups' ? (
        groupsQuery.isError ? (
          <ErrorState
            title="Group search failed"
            description="We could not load matching groups."
            onRetry={groupsQuery.refetch}
          />
        ) : (groupsQuery.groups ?? []).length === 0 ? (
          <EmptyState title="No groups found" description="Try a different search query." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groupsQuery.groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )
      ) : searchQuery.isError ? (
        <ErrorState
          title="Profile search failed"
          description="We could not complete your search."
          onRetry={searchQuery.refetch}
        />
      ) : (searchQuery.data?.results?.profiles ?? []).length === 0 ? (
        <EmptyState title="No profiles found" description="Try a different search query." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(searchQuery.data?.results?.profiles ?? []).map((rec) => (
            <RecommendationCard
              key={rec.userId}
              recommendation={{ ...rec, reason: 'Public community profile' }}
              actionLabel="Follow"
              onAction={handleFollow}
              profileTo={ROUTES.app.community.profile(rec.userId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
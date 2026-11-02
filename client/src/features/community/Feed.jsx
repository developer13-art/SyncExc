import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Hash,
  Home,
  Image,
  Lightbulb,
  Link2,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Send,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

import { Avatar } from '../../components/ui/Avatar.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { PostCard } from './components/PostCard.jsx';
import { PostComposer } from './components/PostComposer.jsx';
import { ReportDialog } from './components/ReportDialog.jsx';
import {
  useCommunityGroups,
  useCommunityPosts,
  useCommunityProfile,
  useCommunitySearch,
} from '../../hooks/useCommunity.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { communityApi } from '../../api/index.js';
import { ROUTES } from '../../config/routes.config.js';

const CATEGORIES = [
  { value: 'all', label: 'All Posts' },
  { value: 'trading', label: 'Trading', icon: BarChart3 },
  { value: 'announcements', label: 'Announcements' },
  { value: 'tips', label: 'Tips & Guides' },
  { value: 'ideas', label: 'Ideas', icon: Lightbulb },
  { value: 'events', label: 'Events', icon: CalendarDays },
];

const HERO_CANDLES = [
  [24, 72], [32, 54], [42, 80], [52, 48], [64, 69], [75, 38], [88, 59],
  [101, 34], [115, 52], [128, 28], [142, 41], [157, 24], [173, 47], [187, 29],
  [202, 39], [218, 19], [232, 34], [248, 15], [264, 28], [279, 13],
];

function matchesCategory(post, category) {
  if (category === 'all') return true;
  const topics = (post.topics ?? [])
    .map((topic) => (typeof topic === 'string' ? topic : topic?.name ?? ''))
    .join(' ')
    .toLowerCase();
  const content = `${topics} ${post.content ?? ''}`.toLowerCase();
  if (category === 'trading') {
    return Boolean(post.marketIdea) || /trade|market|bitcoin|crypto|analysis/.test(content);
  }
  if (category === 'announcements') return /announcement|announcements|news/.test(content);
  if (category === 'tips') return /tips|guide|how.to|tutorial/.test(content);
  if (category === 'ideas') return Boolean(post.marketIdea) || /idea|ideas/.test(content);
  if (category === 'events') return Boolean(post.event);
  return true;
}

function CommunityHeroArt() {
  return (
    <svg
      viewBox="0 0 640 260"
      className="community-hero-art pointer-events-none absolute -right-10 -top-1 h-full w-[62%] min-w-[380px] opacity-90"
      role="img"
      aria-label="Glowing globe with a rising market chart"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="community-globe-fill" cx="48%" cy="42%">
          <stop offset="0%" stopColor="#0d73ed" stopOpacity=".55" />
          <stop offset="75%" stopColor="#071e54" stopOpacity=".2" />
          <stop offset="100%" stopColor="#04142f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="community-chart-line" x1="0" x2="1">
          <stop stopColor="#14b8ff" stopOpacity=".15" />
          <stop offset="100%" stopColor="#27e5c4" />
        </linearGradient>
        <filter id="community-glow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="430" cy="135" r="128" fill="url(#community-globe-fill)" />
      <g fill="none" stroke="#1b8cf5" strokeOpacity=".44">
        <circle cx="430" cy="135" r="107" strokeWidth="1.5" />
        <ellipse cx="430" cy="135" rx="52" ry="107" />
        <ellipse cx="430" cy="135" rx="92" ry="107" />
        <ellipse cx="430" cy="135" rx="106" ry="42" />
        <ellipse cx="430" cy="135" rx="106" ry="78" />
        <path d="M325 135h210M430 28v214" />
      </g>
      <path
        d="M0 204 70 191l35 12 38-42 32 24 35-30 30 9 40-48 38 12 39-41 30 21 38-32 31 16 44-50 47 7 39-27"
        fill="none"
        stroke="url(#community-chart-line)"
        strokeWidth="3"
        filter="url(#community-glow)"
      />
      <g opacity=".82">
        {HERO_CANDLES.map(([x, height], index) => {
          const y = 206 - (index * 8) - height / 2;
          const color = index % 4 === 1 ? '#f34e91' : '#16c9bd';
          return (
            <g key={x} stroke={color} fill={color}>
              <path d={`M${x + 5} ${y - 10}v${height + 20}`} strokeWidth="1.2" />
              <rect x={x} y={y} width="10" height={height} rx="1" opacity=".8" />
            </g>
          );
        })}
      </g>
      <circle cx="430" cy="135" r="111" fill="none" stroke="#26baff" strokeOpacity=".8" filter="url(#community-glow)" />
    </svg>
  );
}

function CommunityStat({ value, label, icon: Icon }) {
  return (
    <div className="community-stat flex items-center gap-2.5 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 backdrop-blur">
      <Icon className="h-4 w-4 shrink-0 text-cyan-300" />
      <span className="min-w-0">
        <strong className="block text-sm leading-4 text-white">{value}</strong>
        <span className="text-[10px] text-slate-300">{label}</span>
      </span>
    </div>
  );
}

export default function Feed() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [category, setCategory] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  const profileQuery = useCommunityProfile();
  const postsQuery = useCommunityPosts({ limit: 30 });
  const groupsQuery = useCommunityGroups({ limit: 5 });
  const searchQuery = useCommunitySearch(
    { q: searchTerm || undefined, type: 'posts', limit: 30 },
    { enabled: Boolean(searchTerm) },
  );

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Community'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
      ]),
    );
  }, [dispatch]);

  const allPosts = searchTerm
    ? searchQuery.data?.results?.posts ?? []
    : postsQuery.posts;
  const activeQuery = searchTerm ? searchQuery : postsQuery;
  const visiblePosts = useMemo(
    () => allPosts.filter((post) => matchesCategory(post, category)),
    [allPosts, category],
  );
  const topicCounts = useMemo(() => {
    const counts = new Map();
    postsQuery.posts.forEach((post) => {
      (post.topics ?? []).forEach((topic) => {
        const name = typeof topic === 'string' ? topic : topic?.name;
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [postsQuery.posts]);
  const activeContributors = useMemo(() => {
    const contributors = new Map();
    postsQuery.posts.forEach((post) => {
      const author = post.author;
      if (!author?.id) return;
      const current = contributors.get(author.id) ?? {
        ...author,
        reactions: 0,
      };
      current.reactions += Number(post.reactionsCount ?? 0);
      contributors.set(author.id, current);
    });
    return [...contributors.values()]
      .sort((a, b) => b.reactions - a.reactions)
      .slice(0, 5);
  }, [postsQuery.posts]);
  const upcomingEvents = useMemo(
    () =>
      postsQuery.posts
        .filter((post) => post.event?.startsAt && new Date(post.event.startsAt) >= new Date())
        .sort((a, b) => new Date(a.event.startsAt) - new Date(b.event.startsAt))
        .slice(0, 3),
    [postsQuery.posts],
  );
  const marketIdeasCount = postsQuery.posts.filter((post) => post.marketIdea).length;
  const postCount = postsQuery.meta.total ?? postsQuery.posts.length;
  const groupCount = groupsQuery.meta.total ?? groupsQuery.groups.length;

  const handleCreatePost = async (values) => {
    try {
      await postsQuery.createPost(values);
      toast.success('Posted');
      setComposerOpen(false);
      await postsQuery.refetch?.();
    } catch (error) {
      toast.error('Failed to post', { description: getErrorMessage(error) });
      throw error;
    }
  };

  const handleReact = async (post) => {
    try {
      await communityApi.addReaction({ postId: post.id, type: 'like' });
      await postsQuery.refetch();
    } catch (error) {
      toast.error('Reaction failed', { description: getErrorMessage(error) });
    }
  };

  const handleBookmark = async (post) => {
    try {
      if (post.viewerBookmarked) {
        await communityApi.removeSavedItem(post.bookmarkId);
      } else {
        await communityApi.saveItem({ postId: post.id });
      }
      await postsQuery.refetch();
    } catch (error) {
      toast.error('Bookmark failed', { description: getErrorMessage(error) });
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
    } catch (error) {
      toast.error('Report failed', { description: getErrorMessage(error) });
      throw error;
    }
  };

  return (
    <div className="community-feed min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          onDebouncedChange={setSearchTerm}
          placeholder="Search in community…"
          delayMs={250}
          className="w-full max-w-sm [&_input]:h-9 [&_input]:rounded-full [&_input]:border-border/80 [&_input]:bg-card/80"
        />
        <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
          <Link to={ROUTES.app.community.discover} className="hover:text-foreground">Discover</Link>
          <Link to={ROUTES.app.community.groups} className="hover:text-foreground">Groups</Link>
          <Link to={ROUTES.app.community.messages} className="hover:text-foreground">Messages</Link>
          <Link to={ROUTES.app.community.myProfile} className="hover:text-foreground">My profile</Link>
        </div>
      </div>

      <section className="community-hero relative isolate flex min-h-[218px] overflow-hidden rounded-2xl border border-blue-400/20 bg-[linear-gradient(112deg,#061328_0%,#071b3a_52%,#03102a_100%)] shadow-[0_18px_56px_-35px_rgba(0,140,255,0.65)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_55%,rgba(0,120,255,0.2),transparent_48%)]" />
        <CommunityHeroArt />
        <div className="community-hero-content relative z-10 flex w-full flex-col justify-center gap-4 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="community-hero-copy max-w-[530px]">
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Sparkles className="h-3 w-3" /> The trader network
            </p>
            <h1 className="community-hero-title text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              SyncExc <span className="community-hero-title-accent text-sky-400">Community</span>
            </h1>
            <p className="mt-1 text-base font-semibold text-blue-100 sm:text-lg">
              Connect. Learn. Share. Grow.
            </p>
            <p className="mt-2 max-w-md text-xs leading-5 text-slate-300 sm:text-sm">
              Share your market perspective, learn from other traders, and grow together.
            </p>
            <div className="community-hero-actions mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                asChild
                className="border-0 bg-blue-600 text-white shadow-lg shadow-blue-950/40 hover:bg-blue-500"
              >
                <Link to={ROUTES.app.community.groups}>
                  <Users className="mr-1.5 h-4 w-4" />
                  <span className="community-join-label">Join a group</span>
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="border-white/25 bg-slate-950/30 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to={ROUTES.app.community.discover}>
                  Explore community <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="community-hero-stats relative z-10 grid max-w-[190px] grid-cols-2 gap-2 lg:grid-cols-1">
            <CommunityStat value={postCount.toLocaleString()} label="Community posts" icon={MessageSquare} />
            <CommunityStat value={groupCount.toLocaleString()} label="Groups to explore" icon={Users} />
            <CommunityStat value={marketIdeasCount.toLocaleString()} label="Trading ideas in feed" icon={BarChart3} />
          </div>
        </div>
      </section>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="flex min-w-0 flex-col gap-3">
          <div className="community-feed-toolbar flex flex-nowrap items-center gap-2">
            <div className="community-feed-tabs flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-thin">
              {CATEGORIES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    category === value
                      ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-950/30'
                      : 'border-border bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {label}
                </button>
              ))}
              <details className="relative shrink-0">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                  More <MoreHorizontal className="h-3.5 w-3.5" />
                </summary>
                <div className="absolute right-0 top-full z-30 mt-2 min-w-40 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                  {[
                    ['Groups', ROUTES.app.community.groups],
                    ['Discussions', ROUTES.app.community.discussions],
                    ['Saved posts', ROUTES.app.community.saved],
                  ].map(([label, path]) => (
                    <Link key={path} to={path} className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
            </div>
            <Button
              size="sm"
              asChild
              className="community-create-post shrink-0 border-0 bg-blue-600 text-white hover:bg-blue-500"
            >
              <Link to={ROUTES.app.community.createPost}>
                <span className="community-create-post-icon mr-1.5 text-base leading-none">＋</span>
                <span className="community-create-post-label">Create post</span>
              </Link>
            </Button>
          </div>

          {!composerOpen ? (
            <Card className="border-border/80 bg-card/90">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    size="md"
                    src={profileQuery.profile?.avatarUrl}
                    fallback={profileQuery.profile?.displayName?.slice(0, 2).toUpperCase() ?? '?'}
                  />
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="min-w-0 flex-1 rounded-xl border border-border/80 bg-background/70 px-4 py-3 text-left text-xs text-muted-foreground transition hover:border-primary/40 sm:text-sm"
                  >
                    Share your thoughts, trading ideas, or ask a question…
                  </button>
                  <Button
                    size="sm"
                    onClick={() => setComposerOpen(true)}
                    className="hidden shrink-0 sm:inline-flex"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Post
                  </Button>
                </div>
                <div className="ml-[52px] mt-2 flex gap-1 border-t border-border/70 pt-2">
                  {[
                    [Image, 'Image'],
                    [BarChart3, 'Market idea'],
                    [Link2, 'Link'],
                  ].map(([Icon, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setComposerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="h-3.5 w-3.5 text-blue-400" /> {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <PostComposer
              user={profileQuery.profile}
              defaultDestination="public"
              onSubmit={handleCreatePost}
              onCancel={() => setComposerOpen(false)}
            />
          )}

          {activeQuery.isLoading ? (
            <LoadingState label="Loading community posts" />
          ) : activeQuery.isError ? (
            <ErrorState
              title={searchTerm ? 'Search failed' : 'Unable to load posts'}
              description="We could not load community posts."
              onRetry={activeQuery.refetch}
            />
          ) : visiblePosts.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title={searchTerm ? 'No matching posts' : category === 'all' ? 'No posts yet' : `No ${CATEGORIES.find((item) => item.value === category)?.label.toLowerCase()} yet`}
              description={searchTerm
                ? 'Try another search phrase or choose a different category.'
                : 'Start the conversation and share something with the community.'}
              action={
                <Button onClick={() => setComposerOpen(true)}>
                  Create a post
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={profileQuery.profile?.userId}
                  onReact={handleReact}
                  onBookmark={handleBookmark}
                  onReport={setReportTarget}
                  className="community-feed-post"
                />
              ))}
            </div>
          )}
        </main>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-[4.5rem]">
          <Card className="border-border/80 bg-card/90">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Active contributors
                </h2>
                <span className="text-[10px] text-muted-foreground">Recent posts</span>
              </div>
              {activeContributors.length ? (
                <ol className="mt-2 divide-y divide-border">
                  {activeContributors.map((contributor, index) => (
                    <li key={contributor.id}>
                      <Link
                        to={ROUTES.app.community.profile(contributor.id)}
                        className="flex items-center gap-2.5 py-2.5"
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${index === 0 ? 'bg-amber-400/15 text-amber-300' : 'bg-muted text-muted-foreground'}`}>
                          {index + 1}
                        </span>
                        <Avatar
                          size="sm"
                          src={contributor.avatarUrl}
                          fallback={contributor.displayName?.slice(0, 2).toUpperCase() ?? '?'}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                          {contributor.displayName ?? 'Community member'}
                        </span>
                        <span className="shrink-0 text-[10px] text-emerald-300">
                          {contributor.reactions.toLocaleString()} reactions
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Contributor activity will appear as posts receive reactions.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BarChart3 className="h-4 w-4 text-cyan-400" />
                  Trending topics
                </h2>
                <Link to={ROUTES.app.community.discover} className="text-[11px] font-medium text-sky-400 hover:text-sky-300">
                  View all <ArrowUpRight className="inline h-3 w-3" />
                </Link>
              </div>
              {topicCounts.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {topicCounts.map(([topic, count]) => (
                    <Link
                      key={topic}
                      to={`${ROUTES.app.community.discover}?q=${encodeURIComponent(topic)}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                    >
                      <Hash className="h-3 w-3 text-sky-400" /> {topic}
                      <span className="text-[9px] text-muted-foreground/70">{count}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Topics shared in community posts will appear here.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarDays className="h-4 w-4 text-emerald-400" />
                  Upcoming events
                </h2>
                <Link to={ROUTES.app.community.discover} className="text-[11px] font-medium text-sky-400 hover:text-sky-300">
                  View all <ArrowUpRight className="inline h-3 w-3" />
                </Link>
              </div>
              {upcomingEvents.length ? (
                <div className="mt-2 divide-y divide-border">
                  {upcomingEvents.map((post) => (
                    <Link key={post.id} to={ROUTES.app.community.post(post.id)} className="flex gap-3 py-3 first:pt-1 last:pb-0">
                      <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-blue-400/20 bg-blue-500/10 text-center">
                        <span className="text-[9px] uppercase text-sky-300">
                          {new Date(post.event.startsAt).toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <strong className="text-sm leading-4 text-foreground">
                          {new Date(post.event.startsAt).getDate()}
                        </strong>
                      </span>
                      <span className="min-w-0">
                        <span className="block line-clamp-2 text-xs font-medium text-foreground">
                          {post.content || 'Community event'}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {new Date(post.event.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          {post.event.timezone ? ` · ${post.event.timezone}` : ''}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Events shared by the community will show up here.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 text-sky-400" /> Suggested groups
                </h2>
                <Link to={ROUTES.app.community.groups} className="text-[11px] font-medium text-sky-400 hover:text-sky-300">
                  View all <ArrowUpRight className="inline h-3 w-3" />
                </Link>
              </div>
              {groupsQuery.groups.length ? (
                <ul className="mt-2 divide-y divide-border">
                  {groupsQuery.groups.slice(0, 4).map((group) => (
                    <li key={group.id}>
                      <Link
                        to={ROUTES.app.community.group(group.id)}
                        className="flex items-center justify-between gap-2 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-foreground">{group.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {(group.memberCount ?? 0).toLocaleString()} members
                          </span>
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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

          <div className="rounded-xl border border-blue-400/20 bg-[linear-gradient(135deg,rgba(13,73,170,0.25),rgba(7,18,40,0.9))] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-cyan-300" /> Grow together
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Invite traders to exchange ideas and learn from one another.
            </p>
            <Link to={ROUTES.app.community.discover} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-white">
              Find traders <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </aside>
      </div>

      <ReportDialog
        open={Boolean(reportTarget)}
        onOpenChange={(open) => { if (!open) setReportTarget(null); }}
        onSubmit={submitReport}
      />
      <nav className="community-bottom-nav" aria-label="Mobile navigation">
        <NavLink
          to={ROUTES.app.dashboard}
          className={({ isActive }) => `community-bottom-nav-item${isActive ? ' is-active' : ''}`}
        >
          <Home aria-hidden="true" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to={ROUTES.app.community.overview}
          aria-current="page"
          className="community-bottom-nav-item is-active"
        >
          <Users aria-hidden="true" />
          <span>Community</span>
        </NavLink>
        <NavLink
          to={ROUTES.app.terminal.overview}
          className={({ isActive }) => `community-bottom-nav-item${isActive ? ' is-active' : ''}`}
        >
          <BarChart3 aria-hidden="true" />
          <span>Trade</span>
        </NavLink>
        <NavLink
          to={ROUTES.app.referral.dashboard}
          className={({ isActive }) => `community-bottom-nav-item${isActive ? ' is-active' : ''}`}
        >
          <Wallet aria-hidden="true" />
          <span>Earnings</span>
        </NavLink>
        <button
          type="button"
          className="community-bottom-nav-item"
          onClick={() => dispatch(uiActions.openMobileNav())}
        >
          <MoreHorizontal aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

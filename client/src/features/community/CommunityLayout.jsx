import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bookmark,
  Compass,
  FileText,
  Home,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { cn } from '../../lib/utils/cn.util.js';
import { ROUTES } from '../../config/routes.config.js';

const NAV_ITEMS = [
  { label: 'For You', path: ROUTES.app.community.feed, icon: Home },
  { label: 'Discover', path: ROUTES.app.community.discover, icon: Compass },
  { label: 'Groups', path: ROUTES.app.community.groups, icon: Users },
  { label: 'Messages', path: ROUTES.app.community.messages, icon: MessageCircle },
  { label: 'Discussions', path: ROUTES.app.community.discussions, icon: MessageCircle },
  { label: 'For you', path: ROUTES.app.community.recommendations, icon: Sparkles },
  { label: 'Analysis', path: ROUTES.app.community.analysis, icon: FileText },
  { label: 'Saved', path: ROUTES.app.community.saved, icon: Bookmark },
  { label: 'Moderation', path: ROUTES.app.community.moderation, icon: ShieldCheck },
  { label: 'Profile', path: ROUTES.app.community.myProfile, icon: Users },
];

function isItemActive(pathname, path) {
  if (path === ROUTES.app.community.feed) {
    return pathname === ROUTES.app.community || pathname === path;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function CommunityLayout() {
  const location = useLocation();

  return (
    <section className="community-layout mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <header className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
              SyncExc Community
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connect · Share · Learn · Grow
            </p>
          </div>
          <Button size="sm" asChild>
            <Link to={ROUTES.app.community.createPost}>
              <Plus className="h-4 w-4" />
              Create post
            </Link>
          </Button>
        </div>
        <nav
          aria-label="Community"
          className="-mb-3 mt-3 flex gap-1 overflow-x-auto border-t border-border pt-2 scrollbar-thin"
        >
          {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
            const active = isItemActive(location.pathname, path);
            return (
              <NavLink
                key={path}
                to={path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <Outlet />
    </section>
  );
}

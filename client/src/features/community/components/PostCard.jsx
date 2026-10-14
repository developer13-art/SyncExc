import { Link } from 'react-router-dom';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../../../components/ui/Dropdown.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function PostCard({
  post,
  onReact,
  onBookmark,
  onReport,
  onDelete,
  currentUserId,
  className,
}) {
  if (!post) {
    return null;
  }

  const author = post.author ?? {};
  const isOwner = currentUserId && author.id === currentUserId;
  const linkTo = ROUTES.app.community.post(post.id);

  const initials = (author.displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isReacted = post.viewerReacted;
  const isBookmarked = post.viewerBookmarked;

  return (
    <Card className={cn('overflow-hidden transition hover:border-border', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link to={ROUTES.app.community.profile(author.id)}>
              <Avatar size="md" src={author.avatarUrl} fallback={initials} />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={ROUTES.app.community.profile(author.id)}
                  className="truncate text-sm font-semibold text-foreground hover:underline"
                >
                  {author.displayName ?? 'User'}
                </Link>
                {author.verified ? (
                  <Badge variant="info" size="sm">
                    Verified
                  </Badge>
                ) : null}
              </div>
              <p className="text-2xs text-muted-foreground">
                {author.handle ? `@${author.handle} · ` : ''}
                {post.createdAt ? formatRelativeTime(post.createdAt) : ''}
                {post.edited ? ' · edited' : ''}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownTrigger asChild>
              <IconButton label="Post actions" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownItem onSelect={() => onBookmark?.(post)}>
                {isBookmarked ? 'Remove bookmark' : 'Save post'}
              </DropdownItem>
              {isOwner ? (
                <>
                  <DropdownSeparator />
                  <DropdownItem
                    onSelect={() => onDelete?.(post)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete post
                  </DropdownItem>
                </>
              ) : (
                <>
                  <DropdownSeparator />
                  <DropdownItem onSelect={() => onReport?.(post)}>Report</DropdownItem>
                </>
              )}
            </DropdownContent>
          </DropdownMenu>
        </div>

        <div className="mt-3">
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {post.content}
          </p>
        </div>

        {post.attachments?.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {post.attachments.slice(0, 4).map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xs text-primary hover:underline"
              >
                {attachment.name}
              </a>
            ))}
          </div>
        ) : null}

        {post.topics?.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.topics.map((topic) => (
              <Badge key={topic} variant="muted" size="sm">
                #{topic}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => onReact?.(post)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition hover:bg-muted',
              isReacted ? 'text-destructive' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Heart className={cn('h-3.5 w-3.5', isReacted && 'fill-current')} />
            {post.reactionsCount ?? 0}
          </button>

          <Link
            to={linkTo}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {post.commentsCount ?? 0}
          </Link>

          <button
            type="button"
            onClick={() => onBookmark?.(post)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition hover:bg-muted',
              isBookmarked
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Bookmark className={cn('h-3.5 w-3.5', isBookmarked && 'fill-current')} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard && post.shareUrl) {
                navigator.clipboard.writeText(post.shareUrl);
              }
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
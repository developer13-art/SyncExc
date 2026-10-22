import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';

import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { IconButton } from '../../../components/ui/IconButton.jsx';
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from '../../../components/ui/Dropdown.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';
import { ROUTES } from '../../../config/routes.config.js';

export function CommentThread({
  comments = [],
  currentUserId,
  onReply,
  onDelete,
  onReport,
  depth = 0,
  className,
}) {
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReply = async (parentId) => {
    if (!replyText.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      const posted = await onReply?.({ parentId, content: replyText.trim() });
      if (posted === false) return;
      setReplyText('');
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (comments.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        No comments yet. Be the first to respond.
      </p>
    );
  }

  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {comments.map((comment) => {
        const author = comment.author ?? {};
        const isOwner = currentUserId && author.id === currentUserId;
        const initials = (author.displayName ?? '?')
          .split(' ')
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();
        const isReplying = replyingTo === comment.id;

        return (
          <li key={comment.id}>
            <div className="flex gap-3">
              <Link to={ROUTES.app.community.profile(author.id)} className="shrink-0">
                <Avatar size="sm" src={author.avatarUrl} fallback={initials} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <Link
                        to={ROUTES.app.community.profile(author.id)}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {author.displayName ?? 'User'}
                      </Link>
                      <span className="text-2xs text-muted-foreground">
                        {comment.createdAt ? formatRelativeTime(comment.createdAt) : ''}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                      {comment.content}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownTrigger asChild>
                      <IconButton label="Comment actions" size="sm">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </IconButton>
                    </DropdownTrigger>
                    <DropdownContent align="end">
                      <DropdownItem onSelect={() => setReplyingTo(comment.id)}>
                        Reply
                      </DropdownItem>
                      {isOwner ? (
                        <DropdownItem
                          onSelect={() => onDelete?.(comment)}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownItem>
                      ) : (
                        <DropdownItem onSelect={() => onReport?.(comment)}>
                          Report
                        </DropdownItem>
                      )}
                    </DropdownContent>
                  </DropdownMenu>
                </div>

                {isReplying ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      placeholder="Write a reply…"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={submitting || !replyText.trim()}
                      >
                        {submitting ? 'Replying…' : 'Reply'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {comment.replies?.length > 0 && depth < 3 ? (
                  <div className="mt-3 border-l-2 border-border pl-4">
                    <CommentThread
                      comments={comment.replies}
                      currentUserId={currentUserId}
                      onReply={onReply}
                      onDelete={onDelete}
                      onReport={onReport}
                      depth={depth + 1}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
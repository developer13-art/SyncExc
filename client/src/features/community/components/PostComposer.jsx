import { useState } from 'react';
import { Send, X } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

const MAX_LENGTH = 5000;

export function PostComposer({
  user,
  destinations = [],
  defaultDestination = 'public',
  onSubmit,
  isSubmitting,
  onCancel,
  className,
}) {
  const [content, setContent] = useState('');
  const [destination, setDestination] = useState(defaultDestination);
  const [topics, setTopics] = useState('');
  const [error, setError] = useState(null);

  const remaining = MAX_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  const isEmpty = content.trim().length === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isEmpty) {
      setError('Write something before posting');
      return;
    }
    if (isOverLimit) {
      setError('Post exceeds maximum length');
      return;
    }

    try {
      await onSubmit?.({
        content: content.trim(),
        destination,
        topics: topics
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setContent('');
      setTopics('');
    } catch (err) {
      setError(err?.message ?? 'Failed to publish post');
    }
  };

  const initials = (user?.displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className={className}>
      <CardContent className="p-4 pt-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Avatar size="md" src={user?.avatarUrl} fallback={initials} />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share analysis, ask a question, or start a discussion…"
              rows={4}
              className={cn(
                'resize-none',
                isOverLimit && 'border-destructive focus-visible:ring-destructive',
              )}
              disabled={isSubmitting}
            />

            {destinations.length > 1 ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground">Post to:</span>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger className="h-8 w-48 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <input
              type="text"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Topics (comma-separated, optional)"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'text-2xs',
                  isOverLimit ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {content.length} / {MAX_LENGTH}
              </span>
              <div className="flex gap-2">
                {onCancel ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={isSubmitting}
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || isEmpty || isOverLimit}
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSubmitting ? 'Posting…' : 'Post'}
                </Button>
              </div>
            </div>

            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
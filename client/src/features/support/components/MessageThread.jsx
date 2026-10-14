import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function MessageThread({ messages = [], className }) {
  if (messages.length === 0) {
    return (
      <p className={cn('py-6 text-center text-xs text-muted-foreground', className)}>
        No messages yet.
      </p>
    );
  }

  return (
    <ul className={cn('flex flex-col gap-4', className)}>
      {messages.map((message) => {
        const author = message.author ?? {};
        const isStaff = author.role === 'staff' || author.isStaff;
        const initials = (author.displayName ?? '?')
          .split(' ')
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <li
            key={message.id}
            className={cn(
              'flex gap-3',
              isStaff ? 'flex-row' : 'flex-row-reverse',
            )}
          >
            <Avatar
              size="sm"
              src={author.avatarUrl}
              fallback={isStaff ? 'SP' : initials}
              className="shrink-0"
            />
            <div
              className={cn(
                'max-w-[85%] rounded-lg border px-4 py-3',
                isStaff
                  ? 'border-border bg-muted/30'
                  : 'border-primary/30 bg-primary/5',
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <p className="text-xs font-medium text-foreground">
                  {author.displayName ?? (isStaff ? 'Support' : 'You')}
                </p>
                {isStaff ? (
                  <Badge variant="info" size="sm">
                    Support
                  </Badge>
                ) : null}
                <span className="text-2xs text-muted-foreground">
                  {message.createdAt ? formatDateTime(message.createdAt) : ''}
                </span>
              </div>
              <div className="whitespace-pre-wrap break-words text-sm text-foreground">
                {message.content}
              </div>
              {message.attachments?.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs text-primary hover:underline"
                      >
                        {attachment.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
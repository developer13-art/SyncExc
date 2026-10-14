import { Link } from 'react-router-dom';
import { Clock, MessageSquare } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { TicketStatusBadge } from '../../../components/domain/ticket/TicketStatusBadge.jsx';
import { TicketPriorityBadge } from '../../../components/domain/ticket/TicketPriorityBadge.jsx';
import { formatRelativeTime } from '../../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../../config/routes.config.js';

export function TicketList({ tickets = [], className }) {
  if (tickets.length === 0) {
    return null;
  }

  return (
    <ul className={className}>
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            to={ROUTES.app.support.ticket(ticket.id)}
            className="block border-b border-border px-5 py-4 transition hover:bg-muted/40 last:border-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {ticket.subject}
                  </p>
                  <TicketStatusBadge status={ticket.status} />
                  {ticket.priority && ticket.priority !== 'normal' ? (
                    <TicketPriorityBadge priority={ticket.priority} />
                  ) : null}
                </div>

                <p className="mt-1 text-2xs uppercase tracking-wide text-muted-foreground">
                  {ticket.reference ? `${ticket.reference} · ` : ''}
                  {ticket.category?.replace(/_/g, ' ') ?? 'general'}
                </p>

                {ticket.excerpt ? (
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                    {ticket.excerpt}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1 text-2xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ticket.updatedAt
                    ? formatRelativeTime(ticket.updatedAt)
                    : ticket.createdAt
                      ? formatRelativeTime(ticket.createdAt)
                      : ''}
                </span>
                {ticket.messageCount !== undefined ? (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {ticket.messageCount}
                  </span>
                ) : null}
                {ticket.awaitingResponseFromUser ? (
                  <Badge variant="warning" size="sm">
                    Awaiting your reply
                  </Badge>
                ) : null}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
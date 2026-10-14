import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Send } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { TicketStatusBadge } from '../../components/domain/ticket/TicketStatusBadge.jsx';
import { TicketPriorityBadge } from '../../components/domain/ticket/TicketPriorityBadge.jsx';
import { MessageThread } from './components/MessageThread.jsx';
import { AttachmentUploader } from './components/AttachmentUploader.jsx';
import { useTicket } from '../../hooks/useSupport.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function TicketDetails() {
  const { ticketId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const ticketQuery = useTicket(ticketId);
  const { ticket, messages, attachments, isLoading, error } = ticketQuery;

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);

  useEffect(() => {
    if (ticket) {
      dispatch(uiActions.setPageTitle(ticket.subject));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Support', path: ROUTES.app.support.overview },
          { label: 'Tickets', path: ROUTES.app.support.tickets },
          {
            label: ticket.reference ?? ticket.subject,
            path: ROUTES.app.support.ticket(ticketId),
          },
        ]),
      );
    }
  }, [ticket, dispatch, ticketId]);

  if (isLoading) {
    return <LoadingState label="Loading ticket" />;
  }

  if (error || !ticket) {
    return (
      <ErrorState
        title="Unable to load ticket"
        description="This ticket could not be retrieved."
        onRetry={ticketQuery.refetch}
      />
    );
  }

  const isClosed = ['closed', 'cancelled'].includes(ticket.status);

  const handleSend = async () => {
    if (!reply.trim() && pendingAttachments.length === 0) {
      return;
    }
    setSending(true);
    try {
      await ticketQuery.postMessage({
        content: reply.trim() || '(attachment)',
        attachmentIds: pendingAttachments.map((a) => a.id),
      });
      setReply('');
      setPendingAttachments([]);
      toast.success('Reply sent');
    } catch (err) {
      toast.error('Failed to send reply', { description: getErrorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const handleUpload = async (file) => {
    try {
      const uploaded = await ticketQuery.uploadAttachment(file);
      setPendingAttachments((prev) => [...prev, uploaded]);
    } catch (err) {
      toast.error('Upload failed', { description: getErrorMessage(err) });
      throw err;
    }
  };

  const handleRemoveAttachment = async (attachment) => {
    try {
      await ticketQuery.removeAttachment?.(attachment.id);
      setPendingAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      toast.error('Remove failed', { description: getErrorMessage(err) });
    }
  };

  const handleReopen = async () => {
    try {
      await ticketQuery.reopenTicket({ reason: 'Issue persists' });
      toast.success('Ticket reopened');
    } catch (err) {
      toast.error('Reopen failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.support.tickets}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {ticket.subject}
            </h1>
            <TicketStatusBadge status={ticket.status} />
            {ticket.priority && ticket.priority !== 'normal' ? (
              <TicketPriorityBadge priority={ticket.priority} />
            ) : null}
          </div>
          <p className="mt-1 text-2xs uppercase tracking-wide text-muted-foreground">
            {ticket.reference ? `${ticket.reference} · ` : ''}
            {ticket.category?.replace(/_/g, ' ') ?? 'general'}
            {ticket.createdAt ? ` · Created ${formatDateTime(ticket.createdAt)}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => ticketQuery.refetch?.()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          {isClosed ? (
            <Button size="sm" onClick={handleReopen}>
              Reopen ticket
            </Button>
          ) : null}
        </div>
      </div>

      {ticket.description ? (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {ticket.description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <MessageThread messages={messages} />
        </CardContent>
      </Card>

      {!isClosed ? (
        <Card>
          <CardHeader>
            <CardTitle>Reply</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              rows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Add a reply…"
            />

            <AttachmentUploader
              attachments={pendingAttachments}
              onUpload={handleUpload}
              onRemove={handleRemoveAttachment}
              disabled={sending}
            />

            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={sending || (!reply.trim() && pendingAttachments.length === 0)}>
                <Send className="h-4 w-4" />
                {sending ? 'Sending…' : 'Send reply'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-muted bg-muted/30">
          <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
            This ticket is {ticket.status}. Reopen it if the issue persists.
          </CardContent>
        </Card>
      )}

      {attachments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm text-foreground">{attachment.name}</span>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-primary hover:underline"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
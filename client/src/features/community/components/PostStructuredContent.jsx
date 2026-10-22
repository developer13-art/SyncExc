import { useEffect, useState } from 'react';

import { communityApi } from '../../../api/index.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../api/errors.js';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';

export function PostStructuredContent({ post, onRefresh }) {
  if (!post?.poll && !post?.event && !post?.marketIdea) return null;
  return (
    <div className="flex flex-col gap-4">
      {post.poll ? <PollContent postId={post.id} poll={post.poll} onRefresh={onRefresh} /> : null}
      {post.event ? <EventContent postId={post.id} event={post.event} onRefresh={onRefresh} /> : null}
      {post.marketIdea ? <MarketIdeaContent idea={post.marketIdea} /> : null}
    </div>
  );
}

function PollContent({ postId, poll, onRefresh }) {
  const toast = useToast();
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const isClosed = poll.closesAt && new Date(poll.closesAt) <= new Date();

  useEffect(() => {
    setSelected(poll.options.filter((option) => option.viewerVoted).map((option) => option.id));
  }, [poll.options]);

  const toggle = (optionId) => {
    if (!poll.allowMultiple) {
      setSelected([optionId]);
      return;
    }
    setSelected((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
    );
  };

  const vote = async () => {
    setSaving(true);
    try {
      await communityApi.voteInPoll(postId, selected);
      await onRefresh?.();
      toast.success('Vote recorded');
    } catch (error) {
      toast.error('Unable to vote', { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{poll.question}</CardTitle>
        {poll.closesAt ? (
          <p className="text-xs text-muted-foreground">
            {isClosed ? 'Closed' : 'Closes'} {formatDateTime(poll.closesAt)}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {poll.options.map((option) => (
          <label key={option.id} className="flex items-center gap-3 rounded-md border border-border p-3">
            <input
              type={poll.allowMultiple ? 'checkbox' : 'radio'}
              name={`poll-${postId}`}
              checked={selected.includes(option.id)}
              onChange={() => toggle(option.id)}
              disabled={Boolean(isClosed) || saving}
            />
            <span className="flex-1 text-sm text-foreground">{option.label}</span>
            <Badge variant="muted">{option.voteCount}</Badge>
          </label>
        ))}
        {!isClosed ? (
          <Button onClick={vote} disabled={selected.length === 0 || saving} className="self-start">
            {saving ? 'Saving…' : 'Vote'}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EventContent({ postId, event, onRefresh }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const rsvp = async (status) => {
    setSaving(true);
    try {
      await communityApi.updateEventRsvp(postId, status);
      await onRefresh?.();
      toast.success('RSVP updated');
    } catch (error) {
      toast.error('Unable to update RSVP', { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Event</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground">
          {formatDateTime(event.startsAt)}
          {event.endsAt ? ` – ${formatDateTime(event.endsAt)}` : ''}
          {' '}({event.timezone})
        </p>
        {event.location ? <p className="text-sm text-muted-foreground">{event.location}</p> : null}
        <p className="text-xs text-muted-foreground">
          {event.goingCount} going · {event.interestedCount} interested
          {event.capacity ? ` · Capacity ${event.capacity}` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={event.viewerRsvp === 'going' ? 'default' : 'outline'}
            onClick={() => rsvp('going')}
            disabled={saving}
          >
            Going
          </Button>
          <Button
            size="sm"
            variant={event.viewerRsvp === 'interested' ? 'default' : 'outline'}
            onClick={() => rsvp('interested')}
            disabled={saving}
          >
            Interested
          </Button>
          {event.viewerRsvp ? (
            <Button size="sm" variant="ghost" onClick={() => rsvp('declined')} disabled={saving}>
              Cancel RSVP
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MarketIdeaContent({ idea }) {
  const levels = [
    ['Entry', idea.entryPrice],
    ['Stop loss', idea.stopLoss],
    ['Take profit', idea.takeProfit],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Market idea: {idea.instrument}
          <Badge variant={idea.direction === 'long' ? 'success' : idea.direction === 'short' ? 'warning' : 'muted'}>
            {idea.direction}
          </Badge>
          <Badge variant="muted">{idea.marketType} · {idea.timeframe}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-sm text-foreground">{idea.thesis}</p>
        {levels.length ? (
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {levels.map(([label, value]) => (
              <div key={label} className="rounded-md bg-muted/40 p-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {idea.invalidation ? (
          <p className="text-xs text-muted-foreground">
            Invalidation: {idea.invalidation}
          </p>
        ) : null}
        <p className="text-2xs text-muted-foreground">
          Informational only. This idea does not create or authorize a trade.
        </p>
      </CardContent>
    </Card>
  );
}

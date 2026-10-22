import { useState } from 'react';
import { Send, X } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { FileUpload } from '../../../components/ui/FileUpload.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select.jsx';
import { cn } from '../../../lib/utils/cn.util.js';
import { communityApi } from '../../../api/index.js';

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
  const [files, setFiles] = useState([]);
  const [destination, setDestination] = useState(defaultDestination);
  const [topics, setTopics] = useState('');
  const [contentKind, setContentKind] = useState('post');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState('');
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollClosesAt, setPollClosesAt] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState('');
  const [eventEndsAt, setEventEndsAt] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventTimezone, setEventTimezone] = useState('UTC');
  const [eventCapacity, setEventCapacity] = useState('');
  const [marketInstrument, setMarketInstrument] = useState('');
  const [marketDirection, setMarketDirection] = useState('long');
  const [marketType, setMarketType] = useState('spot');
  const [marketTimeframe, setMarketTimeframe] = useState('');
  const [marketThesis, setMarketThesis] = useState('');
  const [marketEntry, setMarketEntry] = useState('');
  const [marketStop, setMarketStop] = useState('');
  const [marketTarget, setMarketTarget] = useState('');
  const [marketInvalidation, setMarketInvalidation] = useState('');
  const [error, setError] = useState(null);

  const remaining = MAX_LENGTH - content.length;
  const isOverLimit = remaining < 0;
  const isEmpty = content.trim().length === 0 && files.length === 0;

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

    const options = pollOptions.split('\n').map((value) => value.trim()).filter(Boolean);
    if (contentKind === 'poll' && (!pollQuestion.trim() || options.length < 2)) {
      setError('Polls need a question and at least two options');
      return;
    }
    if (contentKind === 'event' && !eventStartsAt) {
      setError('Choose a start date and time for the event');
      return;
    }
    if (contentKind === 'market' && (!marketInstrument.trim() || !marketTimeframe.trim() || !marketThesis.trim())) {
      setError('Market ideas need an instrument, timeframe, and thesis');
      return;
    }

    const uploadedIds = [];
    try {
      for (const file of files) {
        const uploaded = await communityApi.uploadAttachment(file);
        uploadedIds.push(uploaded.id);
      }
      await onSubmit?.({
        content: content.trim(),
        attachmentIds: uploadedIds,
        destination,
        topics: topics
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        ...(contentKind === 'poll' ? {
          poll: {
            question: pollQuestion.trim(),
            options,
            allowMultiple: pollMultiple,
            ...(pollClosesAt ? { closesAt: new Date(pollClosesAt).toISOString() } : {}),
          },
        } : {}),
        ...(contentKind === 'event' ? {
          event: {
            startsAt: new Date(eventStartsAt).toISOString(),
            ...(eventEndsAt ? { endsAt: new Date(eventEndsAt).toISOString() } : {}),
            timezone: eventTimezone.trim() || 'UTC',
            ...(eventLocation.trim() ? { location: eventLocation.trim() } : {}),
            ...(eventCapacity ? { capacity: Number(eventCapacity) } : {}),
          },
        } : {}),
        ...(contentKind === 'market' ? {
          marketIdea: {
            instrument: marketInstrument.trim(),
            marketType,
            direction: marketDirection,
            timeframe: marketTimeframe.trim(),
            thesis: marketThesis.trim(),
            ...(marketEntry ? { entryPrice: marketEntry } : {}),
            ...(marketStop ? { stopLoss: marketStop } : {}),
            ...(marketTarget ? { takeProfit: marketTarget } : {}),
            ...(marketInvalidation.trim() ? { invalidation: marketInvalidation.trim() } : {}),
          },
        } : {}),
      });
      setContent('');
      setFiles([]);
      setTopics('');
      setContentKind('post');
      setPollQuestion('');
      setPollOptions('');
      setPollMultiple(false);
      setPollClosesAt('');
      setEventStartsAt('');
      setEventEndsAt('');
      setEventLocation('');
      setEventTimezone('UTC');
      setEventCapacity('');
      setMarketInstrument('');
      setMarketDirection('long');
      setMarketType('spot');
      setMarketTimeframe('');
      setMarketThesis('');
      setMarketEntry('');
      setMarketStop('');
      setMarketTarget('');
      setMarketInvalidation('');
    } catch (err) {
      await Promise.allSettled(
        uploadedIds.map((id) => communityApi.deletePendingAttachment(id))
      );
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
            <FileUpload
              accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv"
              multiple
              maxSizeMb={25}
              compact
              value={files}
              onChange={setFiles}
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

            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Post format
              <select
                value={contentKind}
                onChange={(e) => setContentKind(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                disabled={isSubmitting}
              >
                <option value="post">Discussion post</option>
                <option value="poll">Poll</option>
                <option value="event">Event</option>
                <option value="market">Market idea</option>
              </select>
            </label>

            {contentKind === 'poll' ? (
              <div className="grid gap-2 rounded-md border border-border p-3">
                <Input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  maxLength={500}
                  placeholder="Poll question"
                  aria-label="Poll question"
                />
                <Textarea
                  value={pollOptions}
                  onChange={(e) => setPollOptions(e.target.value)}
                  rows={4}
                  placeholder={'One option per line\nOption 1\nOption 2'}
                  aria-label="Poll options"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={pollMultiple}
                    onChange={(e) => setPollMultiple(e.target.checked)}
                  />
                  Allow multiple choices
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Close poll (optional)
                  <Input
                    type="datetime-local"
                    value={pollClosesAt}
                    onChange={(e) => setPollClosesAt(e.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {contentKind === 'event' ? (
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Starts at
                  <Input
                    type="datetime-local"
                    value={eventStartsAt}
                    onChange={(e) => setEventStartsAt(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Ends at (optional)
                  <Input
                    type="datetime-local"
                    value={eventEndsAt}
                    onChange={(e) => setEventEndsAt(e.target.value)}
                  />
                </label>
                <Input
                  value={eventTimezone}
                  onChange={(e) => setEventTimezone(e.target.value)}
                  maxLength={100}
                  placeholder="Timezone (e.g. UTC)"
                  aria-label="Event timezone"
                />
                <Input
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  maxLength={300}
                  placeholder="Location or meeting link"
                  aria-label="Event location"
                />
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={eventCapacity}
                  onChange={(e) => setEventCapacity(e.target.value)}
                  placeholder="Capacity (optional)"
                  aria-label="Event capacity"
                />
              </div>
            ) : null}

            {contentKind === 'market' ? (
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                <Input
                  value={marketInstrument}
                  onChange={(e) => setMarketInstrument(e.target.value)}
                  placeholder="Instrument (e.g. BTCUSDT)"
                  aria-label="Market instrument"
                  maxLength={64}
                />
                <Input
                  value={marketTimeframe}
                  onChange={(e) => setMarketTimeframe(e.target.value)}
                  placeholder="Timeframe (e.g. 4h)"
                  aria-label="Market timeframe"
                  maxLength={64}
                />
                <select
                  value={marketDirection}
                  onChange={(e) => setMarketDirection(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Market direction"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                  <option value="neutral">Neutral</option>
                </select>
                <select
                  value={marketType}
                  onChange={(e) => setMarketType(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Market type"
                >
                  <option value="spot">Spot</option>
                  <option value="futures">Futures</option>
                  <option value="options">Options</option>
                  <option value="forex">Forex</option>
                  <option value="equities">Equities</option>
                  <option value="other">Other</option>
                </select>
                <Textarea
                  value={marketThesis}
                  onChange={(e) => setMarketThesis(e.target.value)}
                  rows={3}
                  placeholder="Thesis and invalidation criteria"
                  aria-label="Market thesis"
                  className="sm:col-span-2"
                />
                <Textarea
                  value={marketInvalidation}
                  onChange={(e) => setMarketInvalidation(e.target.value)}
                  rows={2}
                  placeholder="What would invalidate this idea? (optional)"
                  aria-label="Idea invalidation"
                  className="sm:col-span-2"
                />
                <Input
                  value={marketEntry}
                  onChange={(e) => setMarketEntry(e.target.value)}
                  placeholder="Entry price (optional)"
                  aria-label="Entry price"
                />
                <Input
                  value={marketStop}
                  onChange={(e) => setMarketStop(e.target.value)}
                  placeholder="Stop loss (optional)"
                  aria-label="Stop loss"
                />
                <Input
                  value={marketTarget}
                  onChange={(e) => setMarketTarget(e.target.value)}
                  placeholder="Take profit (optional)"
                  aria-label="Take profit"
                />
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
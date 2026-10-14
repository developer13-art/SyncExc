import { CheckCircle2, Clock, Filter, Sparkles, Upload, User } from 'lucide-react';

import { Timeline } from '../../../components/ui/Timeline.jsx';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';

const EVENT_ICONS = {
  message_received: Upload,
  parser_interpreted: Sparkles,
  ai_interpreted: Sparkles,
  issue_detected: Filter,
  human_reviewed: User,
  validated: CheckCircle2,
  eligibility_decided: CheckCircle2,
  intent_created: CheckCircle2,
};

const EVENT_TONES = {
  message_received: 'info',
  parser_interpreted: 'info',
  ai_interpreted: 'info',
  issue_detected: 'warning',
  human_reviewed: 'success',
  validated: 'success',
  eligibility_decided: 'success',
  intent_created: 'success',
  blocked: 'destructive',
  rejected: 'destructive',
};

export function SignalTimeline({ events = [], className }) {
  const items = events.map((event) => ({
    id: event.id,
    title: event.title ?? event.type,
    description: event.description,
    timestamp: event.occurredAt ? formatDateTime(event.occurredAt) : null,
    icon: EVENT_ICONS[event.type] ?? Clock,
    tone: EVENT_TONES[event.type],
    content: event.content,
  }));

  return <Timeline items={items} className={className} />;
}
import { AlertCircle, CheckCircle2, Clock, PlayCircle, XCircle } from 'lucide-react';

import { Timeline } from '../../../components/ui/Timeline.jsx';
import { formatDateTimeWithSeconds } from '../../../lib/formatters/date.formatter.js';

const EVENT_ICONS = {
  started: PlayCircle,
  step_started: Clock,
  step_completed: CheckCircle2,
  step_failed: XCircle,
  approval_requested: Clock,
  approval_received: CheckCircle2,
  retry_scheduled: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
  outcome_unknown: AlertCircle,
};

const EVENT_TONES = {
  started: 'info',
  step_started: 'info',
  step_completed: 'success',
  step_failed: 'destructive',
  approval_requested: 'warning',
  approval_received: 'success',
  retry_scheduled: 'warning',
  completed: 'success',
  failed: 'destructive',
  cancelled: 'muted',
  outcome_unknown: 'destructive',
};

export function RunTimeline({ events = [], className }) {
  const items = events.map((event) => ({
    id: event.id,
    title: event.title ?? event.type,
    description: event.description,
    timestamp: event.occurredAt ? formatDateTimeWithSeconds(event.occurredAt) : null,
    icon: EVENT_ICONS[event.type] ?? Clock,
    tone: EVENT_TONES[event.type],
  }));

  return <Timeline items={items} className={className} />;
}
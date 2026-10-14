import { AlertCircle, CheckCircle2, Clock, Shield } from 'lucide-react';

import { Timeline } from '../../ui/Timeline.jsx';
import { formatDateTimeWithSeconds } from '../../../lib/formatters/date.formatter.js';

const EVENT_ICONS = {
  detected: AlertCircle,
  created: Clock,
  classified: Shield,
  contained: Shield,
  assigned: Clock,
  investigated: Clock,
  corrected: CheckCircle2,
  resolved: CheckCircle2,
  closed: CheckCircle2,
};

const EVENT_TONES = {
  detected: 'destructive',
  created: 'warning',
  classified: 'warning',
  contained: 'warning',
  assigned: 'info',
  investigated: 'info',
  corrected: 'success',
  resolved: 'success',
  closed: 'success',
};

export function IncidentTimeline({ events = [], className }) {
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
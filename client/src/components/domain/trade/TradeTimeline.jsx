import { AlertCircle, CheckCircle2, Clock, Send, XCircle } from 'lucide-react';

import { Timeline } from '../../ui/Timeline.jsx';
import { formatDateTimeWithSeconds } from '../../../lib/formatters/date.formatter.js';

const EVENT_ICONS = {
  created: Clock,
  validated: CheckCircle2,
  submitted: Send,
  acknowledged: CheckCircle2,
  partial_fill: CheckCircle2,
  filled: CheckCircle2,
  cancelled: XCircle,
  rejected: XCircle,
  reconciliation_required: AlertCircle,
  resolved: CheckCircle2,
};

const EVENT_TONES = {
  created: 'info',
  validated: 'info',
  submitted: 'info',
  acknowledged: 'success',
  partial_fill: 'warning',
  filled: 'success',
  cancelled: 'muted',
  rejected: 'destructive',
  reconciliation_required: 'destructive',
  resolved: 'success',
};

export function TradeTimeline({ events = [], className }) {
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
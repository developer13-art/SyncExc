import { AlertCircle, CheckCircle2, Clock, Send, XCircle } from 'lucide-react';

import { Timeline } from '../../ui/Timeline.jsx';
import { formatDateTimeWithSeconds } from '../../../lib/formatters/date.formatter.js';

const EVENT_ICONS = {
  received: Clock,
  deduplicated: CheckCircle2,
  mapping_resolved: CheckCircle2,
  sizing_calculated: CheckCircle2,
  risk_evaluated: CheckCircle2,
  dispatched: Send,
  acknowledged: CheckCircle2,
  filled: CheckCircle2,
  partially_filled: CheckCircle2,
  rejected: XCircle,
  failed: XCircle,
  retry_scheduled: Clock,
  reconciled: CheckCircle2,
  unresolved: AlertCircle,
};

const EVENT_TONES = {
  received: 'info',
  deduplicated: 'info',
  mapping_resolved: 'info',
  sizing_calculated: 'info',
  risk_evaluated: 'info',
  dispatched: 'info',
  acknowledged: 'success',
  filled: 'success',
  partially_filled: 'warning',
  rejected: 'destructive',
  failed: 'destructive',
  retry_scheduled: 'warning',
  reconciled: 'success',
  unresolved: 'destructive',
};

export function OperationTimeline({ events = [], className }) {
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
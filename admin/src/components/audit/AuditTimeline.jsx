import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Key,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';

import { Timeline } from '../ui/Timeline.jsx';
import { formatDateTimeWithSeconds } from '../../lib/formatters/date.formatter.js';

const ACTION_ICONS = {
  admin_login: ShieldCheck,
  admin_logout: ShieldCheck,
  user_suspended: PauseCircle,
  user_restored: PlayCircle,
  user_sessions_revoked: Key,
  plan_created: FileText,
  plan_published: CheckCircle2,
  refund_approved: CheckCircle2,
  refund_rejected: XCircle,
  exchange_restricted: AlertCircle,
  feature_flag_created: FileText,
  feature_flag_rollout: PlayCircle,
  feature_flag_rollback: PauseCircle,
  role_created: UserCheck,
  role_updated: UserCheck,
  permission_granted: Key,
  approval_granted: CheckCircle2,
  approval_rejected: XCircle,
  audit_exported: FileText,
  data_deleted: Trash2,
};

const ACTION_TONES = {
  admin_login: 'info',
  admin_logout: 'muted',
  user_suspended: 'destructive',
  user_restored: 'success',
  user_sessions_revoked: 'warning',
  plan_created: 'info',
  plan_published: 'success',
  refund_approved: 'success',
  refund_rejected: 'destructive',
  exchange_restricted: 'destructive',
  feature_flag_created: 'info',
  feature_flag_rollout: 'success',
  feature_flag_rollback: 'warning',
  role_created: 'success',
  role_updated: 'info',
  permission_granted: 'info',
  approval_granted: 'success',
  approval_rejected: 'destructive',
  audit_exported: 'info',
  data_deleted: 'destructive',
};

export function AuditTimeline({ events = [], className }) {
  const items = events.map((event) => ({
    id: event.id,
    title: event.action?.replace(/_/g, ' ') ?? 'Action',
    description: composeDescription(event),
    timestamp: event.occurredAt ? formatDateTimeWithSeconds(event.occurredAt) : null,
    icon: ACTION_ICONS[event.action] ?? Clock,
    tone: ACTION_TONES[event.action],
    content: event.before || event.after ? (
      <div className="space-y-2">
        {event.reason ? (
          <p className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground">
            <span className="text-muted-foreground">Reason: </span>
            {event.reason}
          </p>
        ) : null}
      </div>
    ) : null,
  }));

  return <Timeline items={items} className={className} />;
}

function composeDescription(event) {
  const parts = [];
  if (event.actorName) {
    parts.push(`by ${event.actorName}`);
  }
  if (event.targetType) {
    parts.push(
      `on ${event.targetType}${event.targetId ? `:${event.targetId.slice(0, 10)}` : ''}`,
    );
  }
  if (event.outcome && event.outcome !== 'success') {
    parts.push(`(${event.outcome})`);
  }
  return parts.join(' ');
}
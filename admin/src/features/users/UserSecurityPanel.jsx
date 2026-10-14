import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Shield, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../../lib/formatters/date.formatter.js';

export function UserSecurityPanel({ user }) {
  if (!user) {
    return null;
  }

  const events = user.recentSecurityEvents ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Security status</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric
            label="MFA"
            value={user.mfaEnabled ? 'Enabled' : 'Not enabled'}
            tone={user.mfaEnabled ? 'success' : 'warning'}
            icon={user.mfaEnabled ? ShieldCheck : ShieldOff}
          />
          <Metric
            label="Recovery codes"
            value={
              user.recoveryCodesRemaining !== undefined
                ? `${user.recoveryCodesRemaining} remaining`
                : '—'
            }
            tone={
              user.recoveryCodesRemaining === 0 ? 'destructive' : 'default'
            }
          />
          <Metric
            label="Active sessions"
            value={user.activeSessionCount ?? 0}
            icon={Shield}
          />
          <Metric
            label="Trusted devices"
            value={user.trustedDeviceCount ?? 0}
          />
        </CardContent>
      </Card>

      {user.securityRestrictions?.length > 0 ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" />
              <CardTitle className="text-warning">Active restrictions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {user.securityRestrictions.map((restriction, index) => (
              <div key={index} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{restriction.type}</p>
                  {restriction.reason ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {restriction.reason}
                    </p>
                  ) : null}
                </div>
                {restriction.appliedAt ? (
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {formatRelativeTime(restriction.appliedAt)}
                  </span>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent security events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No recent security events for this account.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((event, index) => (
                <li
                  key={event.id ?? index}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.type?.replace(/_/g, ' ') ?? 'event'}
                    </p>
                    {event.description ? (
                      <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      variant={
                        event.outcome === 'success'
                          ? 'success'
                          : event.outcome === 'blocked'
                            ? 'destructive'
                            : 'warning'
                      }
                    >
                      {event.outcome ?? 'recorded'}
                    </Badge>
                    <span className="text-2xs text-muted-foreground">
                      {event.occurredAt ? formatRelativeTime(event.occurredAt) : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, tone = 'default', icon: Icon }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-2xs uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </p>
      <p
        className={
          tone === 'success'
            ? 'mt-1 text-sm font-medium text-success'
            : tone === 'warning'
              ? 'mt-1 text-sm font-medium text-warning'
              : tone === 'destructive'
                ? 'mt-1 text-sm font-medium text-destructive'
                : 'mt-1 text-sm font-medium text-foreground'
        }
      >
        {value}
      </p>
    </div>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatDate, formatDateTime } from '../../lib/formatters/date.formatter.js';

export function UserProfilePanel({ user }) {
  if (!user) {
    return null;
  }

  const fields = [
    { label: 'User ID', value: user.id, mono: true },
    { label: 'Email', value: user.email, masked: user.emailMasked },
    {
      label: 'Email verified',
      value: user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : 'Not verified',
    },
    { label: 'Display name', value: user.displayName ?? '—' },
    { label: 'Username', value: user.username ?? '—' },
    { label: 'Preferred language', value: user.preferredLanguage ?? '—' },
    { label: 'Timezone', value: user.timezone ?? '—' },
    { label: 'Country / region', value: user.countryCode ?? '—' },
    { label: 'Registered', value: formatDateTime(user.createdAt) },
    {
      label: 'Last activity',
      value: user.lastActivityAt ? formatDateTime(user.lastActivityAt) : '—',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>Account profile</CardTitle>
          <Badge
            variant={
              user.status === 'active'
                ? 'success'
                : user.status === 'suspended'
                  ? 'destructive'
                  : 'warning'
            }
          >
            {user.status?.replace(/_/g, ' ') ?? 'unknown'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <dl className="divide-y divide-border">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex items-start justify-between gap-4 px-5 py-3 text-sm"
            >
              <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
              <dd className="min-w-0 truncate text-right">
                <span
                  className={
                    field.mono
                      ? 'font-mono text-xs text-foreground'
                      : 'text-foreground'
                  }
                >
                  {field.value}
                </span>
                {field.masked ? (
                  <Badge variant="muted" size="sm" className="ml-2">
                    masked
                  </Badge>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
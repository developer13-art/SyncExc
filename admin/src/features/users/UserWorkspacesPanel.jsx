import { Link } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Building2 } from 'lucide-react';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function UserWorkspacesPanel({ user }) {
  if (!user) {
    return null;
  }

  const workspaces = user.workspaces ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace memberships</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {workspaces.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No workspaces"
            description="This user does not currently belong to any workspace."
            size="sm"
            className="border-0 bg-transparent py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {workspaces.map((workspace) => (
              <li
                key={workspace.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {workspace.name ?? workspace.id}
                    </p>
                    <Badge variant={workspace.type === 'organization' ? 'info' : 'muted'}>
                      {workspace.type ?? 'workspace'}
                    </Badge>
                    {workspace.roleName ? (
                      <Badge variant="muted">{workspace.roleName}</Badge>
                    ) : null}
                    {workspace.status === 'suspended' ? (
                      <Badge variant="warning">Suspended</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {workspace.joinedAt
                      ? `Joined ${formatRelativeTime(workspace.joinedAt)}`
                      : ''}
                    {workspace.isOwner ? ' · Owner' : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={ROUTES.console.workspaces.details(workspace.id)}>
                    View workspace
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
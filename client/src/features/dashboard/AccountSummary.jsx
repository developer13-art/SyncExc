import { Link } from 'react-router-dom';
import { Building2, ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ConnectionHealthBadge } from '../../components/domain/connection/ConnectionHealthBadge.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatQuantity } from '../../lib/formatters/number.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export function AccountSummary({ overview, isLoading, error }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Unable to load account summary. Please refresh.
          </p>
        </CardContent>
      </Card>
    );
  }

  const accounts = overview?.accounts ?? [];

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Building2}
            title="No connected accounts"
            description="Connect a supported exchange to see balances and positions here."
            action={
              <Button asChild>
                <Link to={ROUTES.app.connections.create}>Connect exchange</Link>
              </Button>
            }
            className="border-0 bg-transparent"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Accounts</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to={ROUTES.app.connections.overview}>
              Manage <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border p-0">
        {accounts.slice(0, 6).map((account) => (
          <Link
            key={account.id}
            to={ROUTES.app.connections.details(account.connectionId)}
            className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {account.label ?? account.exchangeName}
              </p>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                {account.exchangeName} · {account.type ?? 'spot'}
              </p>
              {account.balances?.length ? (
                <p className="mt-1 truncate text-2xs text-muted-foreground">
                  {account.balances
                    .slice(0, 3)
                    .map((balance) => `${balance.asset} ${formatQuantity(balance.total, 8)}`)
                    .join(' · ')}
                  {account.balances.length > 3 ? ` · +${account.balances.length - 3} more` : ''}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">
                {account.equity == null
                  ? '—'
                  : formatCurrency(account.equity, account.currency ?? 'USD')}
              </span>
              <ConnectionHealthBadge status={account.healthStatus} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
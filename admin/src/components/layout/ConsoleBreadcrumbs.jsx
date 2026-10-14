import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';

const LABELS = {
  overview: 'Overview',
  users: 'Users',
  workspaces: 'Workspaces',
  plans: 'Plans',
  subscriptions: 'Subscriptions',
  payments: 'Payments',
  refunds: 'Refunds',
  exchanges: 'Exchanges',
  'source-discovery': 'Source discovery',
  'signal-sources': 'Signal sources',
  referrals: 'Referrals',
  support: 'Support',
  'feature-flags': 'Feature flags',
  roles: 'Roles',
  approvals: 'Approvals',
  audit: 'Audit',
  alerts: 'Alerts',
  'operation-jobs': 'Operation jobs',
  new: 'New',
  policies: 'Policies',
  payouts: 'Payouts',
  'fraud-cases': 'Fraud cases',
  queues: 'Queues',
  rules: 'Rules',
  events: 'Events',
};

function humanize(segment) {
  if (LABELS[segment]) {
    return LABELS[segment];
  }
  if (segment.length > 20) {
    return `${segment.slice(0, 8)}…`;
  }
  return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ConsoleBreadcrumbs({ className }) {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1 text-sm text-muted-foreground', className)}
    >
      <ol className="flex items-center gap-1">
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const to = `/${segments.slice(0, index + 1).join('/')}`;
          const label = humanize(segment);

          return (
            <Fragment key={to}>
              {index > 0 ? (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              ) : null}
              <li className="flex items-center">
                {isLast ? (
                  <span className="truncate font-medium text-foreground">{label}</span>
                ) : (
                  <Link
                    to={to}
                    className="truncate transition hover:text-foreground"
                  >
                    {label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
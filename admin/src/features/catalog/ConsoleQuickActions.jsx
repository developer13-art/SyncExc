import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  Flag,
  Landmark,
  LifeBuoy,
  ListChecks,
  PauseCircle,
  RefreshCcw,
  ScrollText,
  Server,
  Settings,
  ShieldAlert,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

import { Badge } from '../../components/ui/Badge.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';

const ACTIONS = [
  {
    label: 'Suspend or restore a user',
    description: 'Review account status and security posture.',
    path: '/users',
    icon: Users,
  },
  {
    label: 'Exchange connectivity',
    description: 'Inspect adapter health, rate limits and API errors.',
    path: '/catalog/exchanges/api-health',
    icon: Zap,
  },
  {
    label: 'Synchronization groups',
    description: 'Pause or resume trading synchronization groups.',
    path: '/catalog/synchronization/all-synchronization-groups',
    icon: RefreshCcw,
  },
  {
    label: 'Global emergency controls',
    description: 'Pause operations with an incident and audit record.',
    path: '/catalog/risk/global-emergency-controls',
    icon: PauseCircle,
  },
  {
    label: 'Trader payout requests',
    description: 'Approve for settlement or confirm provider settlement.',
    path: '/catalog/payouts/all-payout-requests',
    icon: Wallet,
  },
  {
    label: 'Refund ledger',
    description: 'Review refunds and financial disputes.',
    path: '/refunds',
    icon: CreditCard,
  },
  {
    label: 'Master financial ledger',
    description: 'Immutable double-entry platform ledger entries.',
    path: '/catalog/financial-management/master-ledger',
    icon: Landmark,
  },
  {
    label: 'Incidents',
    description: 'Investigate and resolve platform incidents.',
    path: '/incidents',
    icon: ShieldAlert,
  },
  {
    label: 'Operation jobs',
    description: 'Inspect background jobs and failures.',
    path: '/operation-jobs',
    icon: Server,
  },
  {
    label: 'Approvals',
    description: 'Review pending administrator approvals.',
    path: '/approvals',
    icon: ClipboardCheck,
  },
  {
    label: 'Support queues',
    description: 'Open tickets and assignment queues.',
    path: '/support/queues',
    icon: LifeBuoy,
  },
  {
    label: 'Audit log',
    description: 'Search administrative activity.',
    path: '/audit',
    icon: ScrollText,
  },
  {
    label: 'Feature flags',
    description: 'Control staged feature rollouts.',
    path: '/feature-flags',
    icon: Flag,
  },
  {
    label: 'Maintenance mode',
    description: 'Review platform maintenance settings.',
    path: '/catalog/settings/maintenance-mode',
    icon: Settings,
  },
  {
    label: 'System health',
    description: 'Database, jobs, outbox and exchange health.',
    path: '/catalog/infrastructure/system-overview',
    icon: ListChecks,
  },
];

export function ConsoleQuickActions({ section }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Badge variant="info" size="sm">{section.label}</Badge>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Quick actions</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Jump directly to the operational workflows administrators use most. Every action remains
          permission-checked and audited.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.path} to={action.path} className="group">
              <Card className="h-full transition hover:border-primary/50 hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4 pt-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{action.label}</p>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default ConsoleQuickActions;

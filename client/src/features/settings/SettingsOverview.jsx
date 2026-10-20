import { ArrowUpRight, Bell, BriefcaseBusiness, ChartNoAxesCombined, CircleUserRound, Code2, CreditCard, LifeBuoy, MonitorCog, Network, ShieldCheck, Smartphone, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { SettingsSectionNav } from './components/SettingsSectionNav.jsx';

const cards = [
  {
    title: 'Personal profile',
    description: 'Manage your SyncExc identity and personal information.',
    href: ROUTES.app.settings.profile,
    icon: CircleUserRound,
  },
  {
    title: 'Appearance and preferences',
    description: 'Choose light, dark, or system appearance.',
    href: ROUTES.app.settings.preferences,
    icon: MonitorCog,
  },
  {
    title: 'Trading defaults',
    description: 'Set safe defaults for the terminal. These never grant execution authority.',
    href: ROUTES.app.settings.trading,
    icon: ChartNoAxesCombined,
  },
  {
    title: 'Security and MFA',
    description: 'Change your password and manage multi-factor authentication.',
    href: ROUTES.app.settings.security,
    icon: ShieldCheck,
  },
  {
    title: 'Sessions and devices',
    description: 'Review active sessions and revoke trusted devices.',
    href: ROUTES.app.settings.sessions,
    icon: Smartphone,
  },
  {
    title: 'Notifications',
    description: 'Manage notification delivery preferences and devices.',
    href: ROUTES.app.settings.notifications,
    icon: Bell,
  },
  {
    title: 'Exchange connections',
    description: 'Manage exchange accounts, permissions, and connection health.',
    href: ROUTES.app.connections.overview,
    icon: Network,
  },
  {
    title: 'Signal sources',
    description: 'Connect and manage authorized signal sources.',
    href: ROUTES.app.sources.overview,
    icon: BriefcaseBusiness,
  },
  {
    title: 'Marketplace and copy trading',
    description: 'Review followed traders, subscriptions, and copy configurations.',
    href: ROUTES.app.marketplace.browse,
    icon: UsersRound,
  },
  {
    title: 'Workspaces',
    description: 'Manage workspaces, members, permissions, and settings.',
    href: ROUTES.app.settings.workspaces,
    icon: BriefcaseBusiness,
  },
  {
    title: 'Subscription and billing',
    description: 'View your plan, usage, invoices, and payment history.',
    href: ROUTES.app.billing.overview,
    icon: CreditCard,
  },
  {
    title: 'Developer tools',
    description: 'Manage applications, API credentials, webhooks, and usage.',
    href: ROUTES.app.developer.overview,
    icon: Code2,
  },
  {
    title: 'Referrals',
    description: 'Review referral links, program eligibility, commissions, and payout status.',
    href: ROUTES.app.referral.dashboard,
    icon: UsersRound,
  },
  {
    title: 'Security events',
    description: 'Review authentication activity, account verification, and MFA status.',
    href: ROUTES.app.settings.security,
    icon: ShieldCheck,
  },
  {
    title: 'Help and support',
    description: 'Open the help center and manage support requests.',
    href: ROUTES.app.support.overview,
    icon: LifeBuoy,
  },
];

export default function SettingsOverview() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Settings'));
    dispatch(uiActions.setBreadcrumbs([{ label: 'Settings', path: ROUTES.app.settings.overview }]));
  }, [dispatch]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal account and platform preferences. Workspace permissions and risk controls remain separate.
        </p>
      </header>
      <SettingsSectionNav activePath={ROUTES.app.settings.overview} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ title, description, href, icon: Icon }) => (
          <Link key={title} to={href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" aria-hidden="true" />
                </div>
                <CardTitle className="pt-2">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="sr-only">Open {title}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Globe2,
  GitBranch,
  KeyRound,
  LineChart,
  Lock,
  LockKeyhole,
  Search,
  Repeat,
  Server,
  ShieldCheck,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { ROUTES } from '../../config/routes.config.js';
import { billingApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

const FEATURES_PREVIEW = [
  {
    icon: Repeat,
    title: 'Cross-Exchange Synchronization',
    description:
      'Mirror eligible trading activity across authorized connected accounts with per-destination sizing and partial-failure handling.',
  },
  {
    icon: Shield,
    title: 'Pre-Trade Risk Controls',
    description:
      'Every consequential operation passes through the same risk engine: order limits, position limits, leverage ceilings, and exposure checks.',
  },
  {
    icon: Brain,
    title: 'AI Signal Intelligence',
    description:
      'Interpret messages from approved sources into structured records. Missing data is preserved as missing, never invented.',
  },
  {
    icon: GitBranch,
    title: 'Visual Automation Studio',
    description:
      'Build event-driven workflows with drag-and-drop nodes. Version them, test them, roll them back safely.',
  },
  {
    icon: LineChart,
    title: 'Simulation and Backtesting',
    description:
      'Test configurations against historical data with strict isolation from live execution. Every assumption is labelled.',
  },
  {
    icon: Users,
    title: 'Workspaces and Teams',
    description:
      'Personal and organization workspaces with granular permissions and authorized connection sharing that never exposes credentials.',
  },
];

const STEPS = [
  {
    icon: Server,
    title: 'Connect supported exchanges',
    description:
      'Authorize access to your accounts with restricted API keys. Credentials are encrypted and never exposed.',
  },
  {
    icon: Activity,
    title: 'Configure synchronization and risk',
    description:
      'Define source-to-destination mappings, sizing policies, and pre-trade risk rules with versioned configuration.',
  },
  {
    icon: Sparkles,
    title: 'Add signal sources',
    description:
      'Register supported sources manually or discover candidates through the AI-assisted review workflow.',
  },
  {
    icon: Zap,
    title: 'Monitor and reconcile',
    description:
      'Track every operation from the source event through each destination outcome. Reconcile uncertain states honestly.',
  },
];

const SPOTLIGHT_FEATURES = [
  {
    icon: Repeat,
    title: 'Multi-Exchange Synchronization',
    description: 'Connect accounts and coordinate eligible activity across your exchanges.',
    link: ROUTES.public.features,
    action: 'Explore synchronization',
  },
  {
    icon: Users,
    title: 'Copy Trading Marketplace',
    description: 'Discover trader strategies and manage subscriptions and copy settings.',
    link: ROUTES.app.marketplace.browse,
    action: 'Explore traders',
  },
  {
    icon: Brain,
    title: 'Signal Sources & AI Parsing',
    description: 'Review structured signals and manage approved sources in one place.',
    link: ROUTES.app.signals.overview,
    action: 'View signal tools',
  },
  {
    icon: Zap,
    title: 'Automation Studio',
    description: 'Build workflows with configurable triggers, actions, and risk controls.',
    link: ROUTES.app.automation.overview,
    action: 'Explore automation',
  },
];

const MARKET_PREVIEW = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', tone: 'text-amber-400', path: 'M0 22 12 17 22 20 34 10 46 14 58 5 70 8 82 2' },
  { symbol: 'ETH/USDT', name: 'Ethereum', tone: 'text-sky-400', path: 'M0 18 12 20 22 12 34 15 46 8 58 11 70 4 82 7' },
  { symbol: 'SOL/USDT', name: 'Solana', tone: 'text-violet-400', path: 'M0 20 12 14 22 17 34 8 46 11 58 5 70 8 82 1' },
  { symbol: 'BNB/USDT', name: 'BNB', tone: 'text-yellow-400', path: 'M0 19 12 16 22 18 34 11 46 14 58 7 70 9 82 4' },
];

export default function Home() {
  const plansQuery = useQuery({
    queryKey: queryKeys.billing.plans({ interval: 'monthly' }),
    queryFn: () => billingApi.listPlans({ interval: 'monthly' }),
    staleTime: 5 * 60_000,
    meta: { silentError: true },
  });

  return (
    <div className="client-home-page flex flex-col">
      <section className="client-home-hero relative overflow-hidden border-b border-border">
        <div className="client-market-backdrop" aria-hidden="true">
          <svg
            className="client-market-chart"
            viewBox="0 0 1440 620"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
          >
            <defs>
              <linearGradient id="market-line" x1="160" y1="430" x2="1280" y2="190">
                <stop stopColor="hsl(var(--secondary))" />
                <stop offset=".52" stopColor="hsl(var(--primary))" />
                <stop offset="1" stopColor="hsl(var(--secondary))" />
              </linearGradient>
              <linearGradient id="market-fill" x1="0" y1="150" x2="0" y2="520">
                <stop stopColor="hsl(var(--primary))" stopOpacity=".2" />
                <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
              <pattern id="market-grid" width="96" height="72" patternUnits="userSpaceOnUse">
                <path
                  d="M 96 0 L 0 0 0 72"
                  stroke="hsl(var(--foreground))"
                  strokeOpacity=".12"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            <rect width="1440" height="620" fill="url(#market-grid)" />
            <g className="client-market-candles" strokeLinecap="round">
              <path d="M188 388v72m0-54h20v30h-20" />
              <path d="M280 350v92m0-72h20v36h-20" />
              <path d="M372 292v104m0-80h20v44h-20" />
              <path d="M464 314v86m0-62h20v32h-20" />
              <path d="M556 246v112m0-88h20v48h-20" />
              <path d="M648 270v94m0-72h20v38h-20" />
              <path d="M740 204v118m0-94h20v52h-20" />
              <path d="M832 224v100m0-78h20v40h-20" />
              <path d="M924 174v114m0-90h20v50h-20" />
              <path d="M1016 198v92m0-70h20v34h-20" />
              <path d="M1108 138v118m0-94h20v54h-20" />
              <path d="M1200 164v96m0-74h20v38h-20" />
            </g>
            <path
              d="M144 448 232 404 324 416 416 330 508 350 600 270 692 304 784 224 876 256 968 178 1060 208 1152 132 1244 162 1336 94"
              stroke="url(#market-line)"
              strokeOpacity=".24"
              strokeWidth="32"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M144 448 232 404 324 416 416 330 508 350 600 270 692 304 784 224 876 256 968 178 1060 208 1152 132 1244 162 1336 94V620H144Z"
              fill="url(#market-fill)"
            />
            <path
              className="client-market-flow"
              d="M144 448 232 404 324 416 416 330 508 350 600 270 692 304 784 224 876 256 968 178 1060 208 1152 132 1244 162 1336 94"
              pathLength="1"
              stroke="url(#market-line)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle className="client-market-pulse" cx="968" cy="178" r="7" />
            <circle
              className="client-market-pulse client-market-pulse-delayed"
              cx="600"
              cy="270"
              r="5"
            />
          </svg>
        </div>
        <div className="client-home-container mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-8">
            <div className="client-home-copy">
              <span className="client-eyebrow"><Globe2 className="h-3.5 w-3.5" /> Global multi-exchange trading platform</span>
              <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.06] tracking-[-0.055em] text-foreground sm:text-5xl xl:text-6xl">
                Sync Your Exchanges.
                <span className="client-gradient-text block">Multiply Your Opportunities.</span>
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground md:text-base">
                Trade smarter with SyncExc — a unified platform for exchange connections,
                signal intelligence, and authorized automation. Connect your accounts, set
                your rules, and manage activity across your workspace.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to={ROUTES.auth.register}>Start trading now <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to={ROUTES.public.features}>Explore the platform</Link>
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                No identity document collection. Authorize only what you need.
              </p>
              <div className="client-hero-points mt-7">
                <span><ShieldCheck /> Spot &amp; Futures <small>Trade across supported markets</small></span>
                <span><KeyRound /> Account control <small>You authorize access</small></span>
                <span><Globe2 /> Global access <small>Connect supported exchanges</small></span>
              </div>
            </div>

            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="client-stat-strip border-b border-border" aria-label="Platform principles">
        <div className="client-home-container mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-5 sm:px-6 md:grid-cols-4">
          <PlatformStat icon={Repeat} value="Multi-exchange" label="One connected workspace" />
          <PlatformStat icon={KeyRound} value="Your accounts" label="Access stays under your control" />
          <PlatformStat icon={ShieldCheck} value="Risk-aware" label="Checks before eligible execution" />
          <PlatformStat icon={Clock3} value="Traceable" label="Follow operations and outcomes" />
        </div>
      </section>

      <section className="client-home-section border-b border-border">
        <div className="client-home-container mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-16">
          <div className="grid gap-8 md:grid-cols-[0.75fr_1.25fr] md:items-center">
            <div>
              <span className="client-eyebrow">Powerful features</span>
              <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight text-foreground md:text-4xl">
                Everything You Need for Smarter Trading
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                From multi-exchange synchronization to AI-powered signals, SyncExc brings
                your trading tools together to help you manage, monitor, and automate your
                workflows.
              </p>
              <Button className="mt-6" variant="outline" asChild>
                <Link to={ROUTES.public.features}>Explore all features <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SPOTLIGHT_FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="client-spotlight-card border-border">
                    <CardContent className="flex gap-3 p-4">
                      <div className="client-icon-orb"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{feature.description}</p>
                        <Link className="client-text-link mt-3 inline-flex items-center text-xs font-medium" to={feature.link}>
                          {feature.action}<ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <MarketPreview />
      <SecurityHighlights />

      <section className="client-home-section border-b border-border bg-card/35">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
              Every operation is subject to the same platform safety model
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              No screen, integration, or admin action silently bypasses permissions, financial
              integrity, exchange restrictions, or risk controls.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            <Pillar icon={Lock} label="Least privilege" />
            <Pillar icon={Shield} label="Separation of duties" />
            <Pillar icon={Activity} label="Auditable operations" />
            <Pillar icon={Repeat} label="Reconciled outcomes" />
          </div>
        </div>
      </section>

      <section className="client-home-section border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
              Built for traders who need control
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Unified operational layer between exchanges, signals, and automation — without
              promising profits.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES_PREVIEW.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="client-feature-card border-border bg-card">
                  <CardContent className="p-5 pt-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-10 flex justify-center">
            <Button variant="outline" asChild>
              <Link to={ROUTES.public.features}>
                Explore all features <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="client-home-section border-b border-border bg-card/35">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Four steps from connection to coordinated operations.
            </p>
          </div>

          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <Card className="client-feature-card h-full border-border bg-card">
                    <CardContent className="p-5 pt-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-2xs font-semibold text-muted-foreground">
                          STEP {i + 1}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="client-home-section border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
                Three execution modes, one safety model
              </h2>
              <p className="mt-4 text-sm text-muted-foreground md:text-base">
                Whether you prefer to observe, approve each step, or run authorized automation,
                the platform's authorization, risk, and reconciliation boundaries stay the same.
              </p>

              <ul className="mt-6 flex flex-col gap-3">
                {[
                  'Monitor Only — observe and evaluate without submitting live orders',
                  'Confirm Before Execution — approve each eligible operation explicitly',
                  'Authorized Automation — dispatch eligible operations under active risk controls',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex gap-3">
                <Button asChild>
                  <Link to={ROUTES.public.pricing}>View plans</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to={ROUTES.public.faq}>Read the FAQ</Link>
                </Button>
              </div>
            </div>

            <Card className="client-feature-card border-border bg-card">
              <CardContent className="flex flex-col gap-4 p-6 pt-6">
                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Execution intent
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    An execution intent is not approval to trade. Every downstream module
                    independently checks authorization, capability, entitlement, risk, and
                    current state.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Uncertain outcomes
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Timeouts are treated as ambiguous. The system reconciles before retrying.
                    Notifications never substitute for verified state.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Simulation vs live
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Simulation runs in an isolated context. There is no one-click pathway from
                    a simulated order to a live one.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="client-home-section client-home-pricing border-b border-border">
        <div className="client-home-container mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <span className="client-eyebrow">Simple pricing</span>
              <h2 className="mt-4 text-3xl font-semibold text-foreground md:text-4xl">Choose Your Plan</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Compare the current plans and choose the tools that fit your workflow.
                Pricing and availability are loaded from the platform plan catalog.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-4">
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDollarSign className="h-4 w-4 text-primary" /> Monthly plans</span>
              <Button variant="outline" asChild><Link to={ROUTES.public.pricing}>Compare all plans <ArrowUpRight className="ml-1 h-4 w-4" /></Link></Button>
            </div>
          </div>
          {plansQuery.isLoading ? (
            <p className="mt-8 text-sm text-muted-foreground" role="status">Loading current plans…</p>
          ) : plansQuery.isError ? (
            <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground" role="alert">
              Current plans could not be loaded. <Link className="client-text-link font-medium" to={ROUTES.public.pricing}>View pricing details</Link>
            </div>
          ) : plansQuery.data?.length ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {plansQuery.data.map((plan) => (
                <Card key={plan.id} className={`client-plan-card border-border ${plan.recommended ? 'client-plan-card-featured' : ''}`}>
                  <CardContent className="flex h-full flex-col p-5">
                    {plan.recommended && <span className="client-plan-badge mb-3 self-start">Recommended</span>}
                    <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                    {plan.description && <p className="mt-1 min-h-9 text-xs leading-5 text-muted-foreground">{plan.description}</p>}
                    <p className="mt-4 text-2xl font-semibold text-foreground">
                      {formatCurrency(plan.price, plan.currency, { showSymbol: true })}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">/{plan.billingInterval ?? 'month'}</span>
                    </p>
                    <ul className="mt-4 flex-1 space-y-2">
                      {(plan.features ?? []).map((feature, index) => (
                        <li key={`${plan.id}-${index}`} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          {feature.label ?? feature}
                        </li>
                      ))}
                    </ul>
                    <Button className="mt-5 w-full" variant={plan.recommended ? 'default' : 'outline'} asChild>
                      <Link to={ROUTES.auth.register} state={{ planId: plan.id }}>Get started</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-border bg-background/50 p-5 text-sm text-muted-foreground">
              There are no monthly plans available right now. <Link className="client-text-link font-medium" to={ROUTES.public.pricing}>Visit pricing</Link> for details.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="client-home-container mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <div className="client-home-cta rounded-2xl border border-border p-10 shadow-xl md:p-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">
                Start with the workspace that fits you
              </h2>
              <p className="mt-3 text-sm text-muted-foreground md:text-base">
                Personal or organization, monitoring or authorized automation — the platform
                supports the mode you choose without weakening safety.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" asChild>
                  <Link to={ROUTES.auth.register}>Create your account</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to={ROUTES.public.contact}>Contact us</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="client-dashboard-preview" aria-label="Illustrative SyncExc trading workspace preview">
      <div className="client-dashboard-topbar">
        <div className="flex items-center gap-2">
          <span className="client-dashboard-logo"><Zap className="h-3.5 w-3.5" /></span>
          <span className="text-xs font-semibold text-foreground">SyncExc</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="client-preview-label">Workspace preview</span>
          <span className="client-status-dot" />
          <span className="text-2xs text-muted-foreground">Connected</span>
        </div>
      </div>
      <div className="client-dashboard-body">
        <aside className="client-dashboard-sidebar" aria-hidden="true">
          <span className="client-dashboard-side-active"><LineChart /> Overview</span>
          <span><Repeat /> Synchronize</span>
          <span><Users /> Marketplace</span>
          <span><Activity /> Signals</span>
          <span><Zap /> Automation</span>
        </aside>
        <div className="client-dashboard-content">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-2xs uppercase tracking-[0.16em] text-muted-foreground">Trading workspace</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Markets at a glance</p>
            </div>
            <span className="client-market-select">BTC/USDT <ChevronRight className="h-3 w-3 rotate-90" /></span>
          </div>
          <div className="client-dashboard-chart mt-4">
            <div className="client-chart-guides" aria-hidden="true"><i /><i /><i /><i /></div>
            <svg viewBox="0 0 620 220" role="img" aria-label="Illustrative market chart, not live price data">
              <defs>
                <linearGradient id="client-home-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#08aaff" stopOpacity=".8" />
                  <stop offset="100%" stopColor="#08aaff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="client-chart-candles">
                <path d="M28 133v38m-5-25h10v13H23zM70 111v51m-5-37h10v19H65zM112 126V82m-5 12h10v20h-10zM154 90v54m-5-37h10v19h-10zM196 99V58m-5 13h10v19h-10zM238 72v52m-5-38h10v18h-10zM280 83V43m-5 10h10v20h-10zM322 51v49m-5-37h10v18h-10zM364 62V24m-5 11h10v19h-10zM406 37v47m-5-35h10v18h-10zM448 47V17m-5 9h10v16h-10zM490 23v45m-5-34h10v16h-10zM532 35V9m-5 6h10v14h-10zM574 18v42m-5-31h10v16h-10z" />
              </g>
              <path className="client-chart-line" d="M20 150 62 137 104 119 146 127 188 83 230 95 272 60 314 71 356 39 398 54 440 27 482 37 524 16 580 24" />
              <path className="client-chart-area" d="M20 150 62 137 104 119 146 127 188 83 230 95 272 60 314 71 356 39 398 54 440 27 482 37 524 16 580 24V210H20z" />
            </svg>
            <div className="client-chart-periods"><span>1m</span><span>5m</span><span>15m</span><span>1h</span><span>4h</span><span>1d</span></div>
          </div>
          <div className="client-dashboard-bottom">
            <div className="client-dashboard-mini-card">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Connected exchanges</span>
                <span className="client-preview-label">Example</span>
              </div>
              <div className="client-exchange-row"><span className="client-exchange-mark">B</span><span>Binance</span><span className="client-connected">Ready</span></div>
              <div className="client-exchange-row"><span className="client-exchange-mark client-exchange-mark-blue">By</span><span>Bybit</span><span className="client-connected">Ready</span></div>
            </div>
            <div className="client-dashboard-mini-card">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Recent activity</span>
                <span className="text-2xs text-muted-foreground">Sample view</span>
              </div>
              <p className="client-activity-item"><span className="client-activity-dot" /> Signal reviewed <small>Activity status</small></p>
              <p className="client-activity-item"><span className="client-activity-dot client-activity-dot-purple" /> Sync operation tracked <small>Outcome recorded</small></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformStat({ icon: Icon, value, label }) {
  return (
    <div className="client-platform-stat">
      <span className="client-stat-icon"><Icon className="h-4 w-4" /></span>
      <span><strong>{value}</strong><small>{label}</small></span>
    </div>
  );
}

function MarketPreview() {
  return (
    <section id="market-preview" className="client-home-section border-b border-border" aria-labelledby="market-preview-title">
      <div className="client-home-container mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-center md:py-16">
        <div>
          <span className="client-eyebrow"><TrendingUp className="h-3.5 w-3.5" /> Markets</span>
          <h2 id="market-preview-title" className="mt-4 max-w-md text-3xl font-semibold text-foreground md:text-4xl">
            Market tools, ready when you connect
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Explore supported instruments and open your trading terminal for exchange-provided
            market data. The illustration shows the interface only; it does not display live quotes.
          </p>
          <Button className="mt-6" variant="outline" asChild>
            <Link to={ROUTES.app.terminal.overview}>Open trading terminal <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <div className="client-market-summary mt-6 grid grid-cols-3 gap-2">
            <div><small>Markets</small><strong>Spot &amp; futures</strong></div>
            <div><small>Data source</small><strong>Your exchange</strong></div>
            <div><small>Access</small><strong>On demand</strong></div>
          </div>
        </div>
        <div className="client-market-panel">
          <div className="client-market-panel-head">
            <div><span className="client-eyebrow">Terminal preview</span><h3 className="mt-2 text-sm font-semibold text-foreground">Watchlist &amp; chart</h3></div>
            <span className="client-preview-label"><Search className="h-3 w-3" /> Illustrative</span>
          </div>
          <div className="client-market-table">
            {MARKET_PREVIEW.map((market) => (
              <div className="client-market-row" key={market.symbol}>
                <span className={`client-market-token ${market.tone}`}>{market.symbol.slice(0, 1)}</span>
                <span className="client-market-name"><strong>{market.symbol}</strong><small>{market.name}</small></span>
                <span className="client-market-value">Live data in terminal</span>
                <svg className="client-market-sparkline" viewBox="0 0 82 26" aria-hidden="true"><path d={market.path} /></svg>
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </div>
            ))}
          </div>
          <div className="client-market-disclaimer">Illustrative interface only · quotes and charts load from the selected exchange in the terminal.</div>
        </div>
      </div>
    </section>
  );
}

function SecurityHighlights() {
  const highlights = [
    { icon: LockKeyhole, title: 'Encrypted credentials', description: 'Exchange credentials are protected and never exposed in the interface.' },
    { icon: KeyRound, title: 'Permission-first access', description: 'Authorize only the exchange permissions your use case requires.' },
    { icon: ShieldCheck, title: 'Risk controls', description: 'Execution requests are checked against policy and current capabilities.' },
    { icon: Activity, title: 'Traceable activity', description: 'Review operation states and outcomes across connected workflows.' },
  ];

  return (
    <section className="client-home-security border-b border-border">
      <div className="client-home-container mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center md:py-16">
        <div className="client-security-art" aria-hidden="true">
          <div className="client-security-phone">
            <span className="client-security-notch" />
            <span className="client-dashboard-logo"><Zap className="h-3.5 w-3.5" /></span>
            <p className="mt-5 text-2xs text-muted-foreground">Account connections</p>
            <div className="client-security-account"><span>₿</span><span>Bitcoin<small>Exchange account</small></span></div>
            <div className="client-security-account"><span>Ξ</span><span>Ethereum<small>Exchange account</small></span></div>
            <div className="client-security-secure"><LockKeyhole className="h-3.5 w-3.5" /> Credentials protected</div>
          </div>
          <div className="client-security-screen">
            <div className="client-security-screen-top"><span>SyncExc</span><span>Workspace preview</span></div>
            <div className="client-security-screen-chart">
              <svg viewBox="0 0 400 150" aria-hidden="true"><path d="M0 116 35 102 70 111 105 73 140 84 175 60 210 77 245 43 280 55 315 26 350 38 400 12" /></svg>
            </div>
            <div className="client-security-screen-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
        </div>
        <div>
          <span className="client-eyebrow"><ShieldCheck className="h-3.5 w-3.5" /> Security &amp; trust</span>
          <h2 className="mt-4 text-3xl font-semibold text-foreground md:text-4xl">Your Security, Our Priority.</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Security and control are built into the way you connect accounts, authorize actions,
            and review activity across the platform.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div className="client-security-item" key={title}>
                <span className="client-security-icon"><Icon className="h-4 w-4" /></span>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pillar({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-xs font-medium text-foreground">{label}</p>
    </div>
  );
}
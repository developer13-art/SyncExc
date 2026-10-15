import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  GitBranch,
  LineChart,
  Lock,
  Repeat,
  Server,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { ROUTES } from '../../config/routes.config.js';

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

export default function Home() {
  return (
    <div className="flex flex-col">
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
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Multi-exchange operations, unified
            </span>

            <h1 className="mt-8 text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-7xl">
              One workspace for every exchange you trade on
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-base text-muted-foreground md:text-xl">
              SyncExc coordinates exchange connections, signal intelligence, and authorized
              automation behind consistent risk controls — with traceable execution and honest
              state reporting at every step.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link to={ROUTES.auth.register}>
                  Get started <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to={ROUTES.public.features}>See features</Link>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              No identity document collection. Authorize only what you need.
            </p>
          </div>
        </div>
      </section>

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

      <section>
        <div className="mx-auto max-w-7xl px-6 py-20">
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
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
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#edf3f8]">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Multi-exchange operations, unified
            </span>

            <h1 className="mt-8 text-4xl font-semibold tracking-[-0.06em] text-slate-900 md:text-7xl">
              One workspace for every exchange you trade on
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-base text-slate-600 md:text-xl">
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

            <p className="mt-4 text-xs text-slate-500">
              No identity document collection. Authorize only what you need.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50/80">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Every operation is subject to the same platform safety model
            </h2>
            <p className="mt-3 text-sm text-slate-600 md:text-base">
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

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Built for traders who need control
            </h2>
            <p className="mt-3 text-sm text-slate-600 md:text-base">
              Unified operational layer between exchanges, signals, and automation — without
              promising profits.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES_PREVIEW.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-slate-200 bg-slate-50/80 shadow-[0_12px_30px_rgba(15,23,42,0.03)]">
                  <CardContent className="p-5 pt-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
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

      <section className="border-b border-slate-200 bg-slate-50/80">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-sm text-slate-600 md:text-base">
              Four steps from connection to coordinated operations.
            </p>
          </div>

          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <Card className="h-full border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.03)]">
                    <CardContent className="p-5 pt-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-2xs font-semibold text-slate-500">
                          STEP {i + 1}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
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

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Three execution modes, one safety model
              </h2>
              <p className="mt-4 text-sm text-slate-600 md:text-base">
                Whether you prefer to observe, approve each step, or run authorized automation,
                the platform's authorization, risk, and reconciliation boundaries stay the same.
              </p>

              <ul className="mt-6 flex flex-col gap-3">
                {[
                  'Monitor Only — observe and evaluate without submitting live orders',
                  'Confirm Before Execution — approve each eligible operation explicitly',
                  'Authorized Automation — dispatch eligible operations under active risk controls',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
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

            <Card className="border-slate-200 bg-slate-50/80 shadow-[0_12px_30px_rgba(15,23,42,0.03)]">
              <CardContent className="flex flex-col gap-4 p-6 pt-6">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Execution intent
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    An execution intent is not approval to trade. Every downstream module
                    independently checks authorization, capability, entitlement, risk, and
                    current state.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Uncertain outcomes
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Timeouts are treated as ambiguous. The system reconciles before retrying.
                    Notifications never substitute for verified state.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Simulation vs live
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
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
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-100 p-10 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                Start with the workspace that fits you
              </h2>
              <p className="mt-3 text-sm text-slate-600 md:text-base">
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
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Icon className="h-4 w-4 text-blue-700" />
      </div>
      <p className="text-xs font-medium text-slate-700">{label}</p>
    </div>
  );
}
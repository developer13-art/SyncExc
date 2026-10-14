import { Activity, Heart, Lock, Shield, Users, Zap } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';

const VALUES = [
  {
    icon: Shield,
    title: 'Honest state over encouraging state',
    description:
      'When data is stale, uncertain, or unavailable, the platform says so. We do not fabricate values, silently show zero, or claim success from an ambiguous outcome.',
  },
  {
    icon: Lock,
    title: 'Least privilege across every layer',
    description:
      'Roles, permissions, entitlements, and capabilities compose on every request. No single role, screen, or integration can bypass the model.',
  },
  {
    icon: Activity,
    title: 'Auditable by construction',
    description:
      'Consequential actions produce durable audit records. Financial and execution history is append-only. Corrections create new records instead of erasing the past.',
  },
  {
    icon: Zap,
    title: 'Reconciliation before retry',
    description:
      'Timeouts and disconnects are treated as ambiguous. The platform reconciles authoritative state before any action that could duplicate an effect.',
  },
  {
    icon: Users,
    title: 'Workspace boundaries respected',
    description:
      'Personal and organization workspaces operate independently, with explicit, revocable sharing grants that never expose raw credentials.',
  },
  {
    icon: Heart,
    title: 'No promises of profit',
    description:
      'SyncExc is an operational layer. We do not promise outcomes, predict performance, or market financial returns.',
  },
];

export default function About() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          About SyncExc
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          A unified operational layer between exchanges, signals, and automation — with
          consistent risk controls and honest, traceable state.
        </p>
      </div>

      <section className="mt-16">
        <Card>
          <CardContent className="p-8 pt-8">
            <h2 className="text-lg font-semibold text-foreground">What SyncExc is</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
              <p>
                SyncExc is a platform for traders who operate across multiple exchanges.
                Instead of switching between dashboards, users coordinate eligible trading
                activity from a single workspace with configurable synchronization, source
                management, automation, simulation, and consistent risk evaluation.
              </p>
              <p>
                The platform is designed for individual traders, experienced operators, signal
                providers, teams, organizations, and developers who need a structured way to
                manage multi-exchange operations. It is not a strategy engine, an investment
                advisor, or a claim of trading performance.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-foreground">What guides the platform</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {VALUES.map((value) => {
            const Icon = value.icon;
            return (
              <Card key={value.title}>
                <CardContent className="p-5 pt-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{value.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <Card className="bg-muted/30">
          <CardContent className="p-8 pt-8">
            <h2 className="text-lg font-semibold text-foreground">
              What SyncExc does not do
            </h2>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <li>Collect identity documents through an in-platform KYC workflow</li>
              <li>Request exchange API keys with withdrawal permission</li>
              <li>Promise returns, predict performance, or market financial products</li>
              <li>Bypass risk controls because a feature, role, or screen exists</li>
              <li>Reward commissions based on trading volume or losses</li>
              <li>Execute trades directly from AI output, community posts, or admin actions</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Code2,
  Coins,
  FileSearch,
  GitBranch,
  Headphones,
  LineChart,
  Lock,
  MessageSquare,
  Radio,
  Repeat,
  Shield,
  Sliders,
  Sparkles,
  Store,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';

const FEATURE_GROUPS = [
  {
    title: 'Trading Operations',
    description:
      'Bring supported exchange activity into a single workspace with consistent execution tracking.',
    features: [
      {
        icon: Sliders,
        title: 'Unified Trading Terminal',
        description:
          'Spot and derivatives surfaces with account selection, order management, positions, and clear execution status across connected exchanges.',
      },
      {
        icon: Repeat,
        title: 'Cross-Exchange Synchronization',
        description:
          'Mirror eligible events to authorized destinations with configurable sizing, per-destination rules, and partial-failure handling.',
      },
      {
        icon: BarChart3,
        title: 'Portfolio Aggregation',
        description:
          'Consolidated views while preserving each exchange-specific semantics, freshness, and known limitations.',
      },
    ],
  },
  {
    title: 'Risk and Safety',
    description:
      'Every consequential operation passes the same authorization, risk, and reconciliation boundaries.',
    features: [
      {
        icon: Shield,
        title: 'Pre-Trade Risk Engine',
        description:
          'Order limits, position limits, leverage ceilings, exposure aggregation, and approval workflows evaluated before dispatch.',
      },
      {
        icon: Zap,
        title: 'Emergency Pause and Circuit Breakers',
        description:
          'Scoped pauses that stop new eligible dispatches while continuing to track already-submitted orders honestly.',
      },
      {
        icon: Activity,
        title: 'Real-Time Monitoring',
        description:
          'Detect limit breaches, stale data, unexpected positions, and reconciliation discrepancies with configurable severity.',
      },
    ],
  },
  {
    title: 'Signal Intelligence',
    description:
      'Interpret approved sources into structured, traceable records without inventing data.',
    features: [
      {
        icon: Radio,
        title: 'Source Discovery and Management',
        description:
          'Manual or AI-assisted discovery, validation, review, and lifecycle management of supported signal sources.',
      },
      {
        icon: Brain,
        title: 'AI-Assisted Interpretation',
        description:
          'Deterministic parsers first; constrained AI when needed. Outputs schema-validated and reviewed before downstream use.',
      },
      {
        icon: FileSearch,
        title: 'Traceability by Design',
        description:
          'Every extracted field links back to evidence. Missing data is preserved as missing; corrections create new versions.',
      },
    ],
  },
  {
    title: 'Automation and Simulation',
    description:
      'Build, test, and version workflows without shortcutting execution safeguards.',
    features: [
      {
        icon: Workflow,
        title: 'Visual Workflow Builder',
        description:
          'Drag-and-drop canvas with triggers, conditions, approvals, and downstream service calls — never direct exchange access.',
      },
      {
        icon: GitBranch,
        title: 'Versioned Deployment',
        description:
          'Draft, validate, publish, activate, pause, and roll back workflows without rewriting historical runs.',
      },
      {
        icon: LineChart,
        title: 'Simulation and Backtesting',
        description:
          'Isolated simulation contexts with dataset versioning, fill models, and clearly labelled assumptions.',
      },
    ],
  },
  {
    title: 'Platform and Ecosystem',
    description:
      'Everything that surrounds the trading loop — from identity to community to developer tooling.',
    features: [
      {
        icon: Users,
        title: 'Workspaces and Teams',
        description:
          'Personal and organization workspaces with granular permissions and explicit connection-sharing grants.',
      },
      {
        icon: Store,
        title: 'Copy Trading Marketplace',
        description:
          'Provider profiles, published signals, subscriber plans, and explicit per-destination copy configurations.',
      },
      {
        icon: Code2,
        title: 'Developer Platform',
        description:
          'Versioned public API, scoped credentials, signed webhooks, delivery logs, and sandbox testing.',
      },
      {
        icon: Sparkles,
        title: 'AI-Assisted Discovery',
        description:
          'Recommendations for people and communities grounded in permitted signals with explainable reasons.',
      },
      {
        icon: MessageSquare,
        title: 'Community and Collaboration',
        description:
          'Public profiles, groups, shared analysis documents, and private workspace discussions with moderation.',
      },
      {
        icon: Bell,
        title: 'Notifications and Alerts',
        description:
          'Centralized event delivery with deduplication, priority, quiet hours, and channel-specific delivery state.',
      },
      {
        icon: Headphones,
        title: 'Customer Support Portal',
        description:
          'Ticket tracking, secure attachments, help center, escalation, and auditable support access.',
      },
      {
        icon: BookOpen,
        title: 'Administrator Console',
        description:
          'Centralized oversight with granular roles, approvals, feature flags, and durable audit history.',
      },
      {
        icon: Lock,
        title: 'Security by Default',
        description:
          'MFA, step-up authentication, least privilege, session management, and encrypted credential handling.',
      },
      {
        icon: Coins,
        title: 'Referral and Commission Governance',
        description:
          'Subscription-revenue-based direct referrals with auditable ledger, payout oversight, and fraud controls.',
      },
    ],
  },
];

export default function Features() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Platform features
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Every capability is subject to the same authorization, entitlement, capability, and
          risk boundaries — across every module, without exception.
        </p>
      </div>

      <div className="mt-16 flex flex-col gap-16">
        {FEATURE_GROUPS.map((group) => (
          <section key={group.title}>
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {group.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="h-full">
                    <CardContent className="p-5 pt-5">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
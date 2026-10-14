import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/Accordion.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ROUTES } from '../../config/routes.config.js';

const CATEGORIES = [
  {
    title: 'Getting started',
    items: [
      {
        q: 'What do I need before connecting an exchange?',
        a: 'You need an exchange account that supports API access and a set of API credentials you are willing to authorize for SyncExc. We recommend read-only or trading permissions only — SyncExc does not use withdrawal permissions.',
      },
      {
        q: 'Does SyncExc collect identity documents?',
        a: 'No. SyncExc does not include an in-platform KYC workflow. Account security and recovery are separate from identity-document collection. If a third-party payment or payout provider independently requires checks under its own rules, that is disclosed where it applies.',
      },
      {
        q: 'How are API credentials stored?',
        a: 'Credentials are encrypted at rest using managed encryption keys. They are never exposed in the UI after initial entry, are never returned by API responses, and are never written to application logs.',
      },
    ],
  },
  {
    title: 'Trading and execution',
    items: [
      {
        q: 'How does cross-exchange synchronization work?',
        a: 'You define a synchronization group with a source account and one or more authorized destination accounts. When an eligible source event occurs, the platform resolves mappings and sizing, then evaluates per-destination authorization and risk before dispatching. Each destination has an independent outcome.',
      },
      {
        q: 'What happens if one destination fails but others succeed?',
        a: 'Each destination has an independent lifecycle. One destination\'s failure does not cancel another\'s success, and the platform does not automatically rebalance unaffected destinations.',
      },
      {
        q: 'How are uncertain submission outcomes handled?',
        a: 'Timeouts and ambiguous responses are treated as unresolved. The platform reconciles against authoritative exchange state before considering a retry, so it does not risk creating a duplicate order.',
      },
      {
        q: 'Can I run in monitoring-only mode?',
        a: 'Yes. Monitor Only mode observes and evaluates without submitting live orders. It is one of three execution modes: Monitor Only, Confirm Before Execution, and Authorized Automation.',
      },
    ],
  },
  {
    title: 'Signal sources and automation',
    items: [
      {
        q: 'How does AI signal interpretation work?',
        a: 'Deterministic parsers are tried first against known templates. When a message needs contextual interpretation, a constrained AI step extracts structured output. The output is schema-validated and, if uncertain, routed to human review. Missing data is preserved as missing — never invented.',
      },
      {
        q: 'Can a workflow execute a trade directly?',
        a: 'No. Workflows request operations from the appropriate downstream service. That service independently performs authentication, authorization, entitlement, capability, risk, and idempotency checks before considering dispatch.',
      },
      {
        q: 'Is simulation the same as live trading?',
        a: 'No. Simulation runs in an isolated execution context with a virtual account ledger. Live execution adapters are not accessible from simulation, and there is no one-click pathway from a simulated order to a live one.',
      },
    ],
  },
  {
    title: 'Billing and plans',
    items: [
      {
        q: 'What happens if my subscription expires?',
        a: 'New paid operations are restricted according to policy. Existing external exchange orders and positions are not affected — subscription state does not cancel orders or close positions at the exchange.',
      },
      {
        q: 'Are referral commissions based on trading activity?',
        a: 'No. The referral program rewards eligible direct referrals based on qualifying subscription payments only — never on trading volume, losses, or exchange account balances.',
      },
    ],
  },
  {
    title: 'Security and support',
    items: [
      {
        q: 'How do I report a security concern?',
        a: 'Email the security address listed on the Contact page. Do not include credentials in your message. If your account may be compromised, use the in-app Support Portal to open an urgent ticket.',
      },
      {
        q: 'What if I lose access to my MFA device?',
        a: 'Use the recovery-code workflow during sign-in. If recovery codes are unavailable, an authorized administrator-controlled account recovery process applies. A password reset alone does not silently disable MFA.',
      },
    ],
  },
];

export default function Faq() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Frequently asked questions
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Answers about accounts, trading, signals, automation, and billing.
        </p>
      </div>

      <div className="mt-16 flex flex-col gap-12">
        {CATEGORIES.map((category) => (
          <section key={category.title}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">{category.title}</h2>
            <Accordion type="single" collapsible>
              {category.items.map((item, i) => (
                <AccordionItem key={i} value={`${category.title}-${i}`}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">{item.a}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>

      <div className="mt-16 rounded-lg border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm font-medium text-foreground">Still have questions?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The Support Portal can route your request to the right team with the necessary context.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Button asChild>
            <Link to={ROUTES.auth.login}>Sign in to Support</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={ROUTES.public.contact}>Contact us</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
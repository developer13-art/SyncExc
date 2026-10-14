import { Card, CardContent } from '../../components/ui/Card.jsx';
import { APP } from '../../lib/constants/app.constants.js';

const LAST_UPDATED = '2026-10-14';

export default function Terms() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
      </div>

      <Card className="mt-12">
        <CardContent className="prose prose-sm max-w-none p-8 pt-8">
          <div className="flex flex-col gap-6 text-sm text-foreground">
            <Section title="Agreement">
              <p>
                By accessing or using {APP.NAME}, you agree to these Terms of Service. If you do
                not agree, do not use the platform.
              </p>
            </Section>

            <Section title="What SyncExc is">
              <p>
                {APP.NAME} is an operational layer for coordinating trading activity across
                supported cryptocurrency exchanges. It connects to exchanges through APIs you
                authorize, processes signals from sources you configure, and dispatches
                operations under your configuration and the platform's risk controls.
              </p>
              <p>
                SyncExc is not a broker, exchange, advisor, or financial institution. It does
                not hold funds, does not provide investment advice, and does not promise
                trading outcomes.
              </p>
            </Section>

            <Section title="Your responsibilities">
              <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground">
                <li>
                  You are responsible for maintaining the security of your account, your email,
                  your MFA configuration, and your device.
                </li>
                <li>
                  You are responsible for the API credentials you authorize and for the
                  permissions you grant at each exchange.
                </li>
                <li>
                  You are responsible for the configurations you create: synchronization
                  groups, sizing policies, risk policies, workflows, and copy configurations.
                </li>
                <li>
                  You agree not to use SyncExc to violate exchange terms, applicable laws, or
                  the rights of others.
                </li>
                <li>
                  You agree not to attempt to bypass authorization, risk controls, or
                  rate limits.
                </li>
              </ul>
            </Section>

            <Section title="Platform behavior you should expect">
              <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground">
                <li>
                  Every consequential operation is subject to authorization, entitlement,
                  capability, and risk evaluation.
                </li>
                <li>
                  Uncertain outcomes are treated as unresolved and reconciled before retry.
                </li>
                <li>
                  Simulation results are isolated from live execution and labeled as such.
                </li>
                <li>
                  Notifications report events. They do not establish the underlying business
                  outcome.
                </li>
                <li>
                  Subscriptions define feature access. They do not override platform safety
                  controls.
                </li>
              </ul>
            </Section>

            <Section title="No guarantee of execution">
              <p>
                Because SyncExc coordinates operations across third-party exchanges, we cannot
                guarantee that any specific operation will be accepted, filled, or completed
                as intended. Exchanges can reject orders, disconnect, impose rate limits, or
                behave differently from documentation. The platform surfaces this uncertainty
                honestly rather than masking it.
              </p>
            </Section>

            <Section title="No financial advice">
              <p>
                SyncExc does not provide financial, legal, tax, or investment advice. Nothing
                on the platform should be construed as a recommendation to buy, sell, or hold
                any asset.
              </p>
            </Section>

            <Section title="Subscriptions and billing">
              <p>
                Subscription plans are offered under the terms displayed at the time of
                purchase. Prices and included features may change for new subscribers; existing
                subscribers retain their agreed price until a valid price-change policy takes
                effect.
              </p>
            </Section>

            <Section title="Referral program">
              <p>
                The referral program rewards eligible direct referrals based on qualifying
                subscription payments. Commissions are never based on trading volume, losses,
                or exchange account balances. Program terms may be updated prospectively with
                notice.
              </p>
            </Section>

            <Section title="Termination">
              <p>
                You may stop using SyncExc at any time and request account deletion. We may
                suspend or terminate access for violations of these terms, security concerns,
                or applicable legal requirements. Termination does not affect the exchange
                side of your activity — orders already submitted to an exchange remain subject
                to the exchange's own rules.
              </p>
            </Section>

            <Section title="Limitation of liability">
              <p>
                To the maximum extent permitted by applicable law, {APP.NAME} is not liable for
                indirect, incidental, special, consequential, or punitive damages arising from
                your use of the platform, including trading losses, missed opportunities, or
                losses arising from third-party exchange behavior.
              </p>
            </Section>

            <Section title="Changes">
              <p>
                We may update these terms. Material changes will be communicated through the
                platform. Continued use after the effective date constitutes acceptance of the
                updated terms.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                For questions about these terms, contact{' '}
                <a href={`mailto:${APP.SUPPORT_EMAIL}`} className="text-primary hover:underline">
                  {APP.SUPPORT_EMAIL}
                </a>
                .
              </p>
            </Section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground">{children}</div>
    </section>
  );
}
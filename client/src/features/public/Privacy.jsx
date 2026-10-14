import { Card, CardContent } from '../../components/ui/Card.jsx';
import { APP } from '../../lib/constants/app.constants.js';

const LAST_UPDATED = '2026-10-14';

export default function Privacy() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
      </div>

      <Card className="mt-12">
        <CardContent className="prose prose-sm max-w-none p-8 pt-8">
          <div className="flex flex-col gap-6 text-sm text-foreground">
            <Section title="Overview">
              <p>
                This Privacy Policy explains how {APP.NAME} collects, uses, stores, and shares
                information in connection with your use of the platform. It reflects the design
                principles described throughout the product: least privilege, honest state
                reporting, and auditable operations.
              </p>
            </Section>

            <Section title="Information we collect">
              <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground">
                <li>
                  Account information: display name, username, email address, preferred
                  language, and time zone that you provide during registration and profile
                  management.
                </li>
                <li>
                  Authentication data: password hash, MFA configuration, session records,
                  trusted device references, and security-event history.
                </li>
                <li>
                  Workspace data: workspace metadata, memberships, role assignments,
                  invitations, sharing grants, and audit history.
                </li>
                <li>
                  Exchange connection data: encrypted API credentials and non-sensitive
                  metadata required to interact with the exchange account you explicitly
                  authorize.
                </li>
                <li>
                  Operational data: order, fill, position, synchronization operation, signal
                  record, workflow run, and reconciliation history required for the platform
                  to function.
                </li>
                <li>
                  Support and communication: tickets, messages, attachments, and feedback you
                  submit through the Support Portal.
                </li>
                <li>
                  Security and audit: authentication events, permission changes, administrative
                  actions, and audit records required for platform integrity.
                </li>
              </ul>
            </Section>

            <Section title="Information we do not collect">
              <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground">
                <li>Exchange account passwords, wallet private keys, or MFA seed phrases.</li>
                <li>
                  Identity documents through an in-platform KYC workflow. Where a third-party
                  provider requires verification under its own rules, that is handled by the
                  provider directly and disclosed where it applies.
                </li>
                <li>
                  Data from exchanges, workspaces, or resources that you have not explicitly
                  authorized the platform to access.
                </li>
              </ul>
            </Section>

            <Section title="How we use information">
              <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground">
                <li>To authenticate you and secure your account.</li>
                <li>
                  To execute operations you have authorized — including synchronization,
                  workflow dispatch, and simulation runs.
                </li>
                <li>
                  To enforce authorization, entitlements, capabilities, and risk controls on
                  every consequential action.
                </li>
                <li>
                  To reconcile uncertain outcomes against authoritative exchange state before
                  retrying.
                </li>
                <li>
                  To maintain audit records for consequential actions, financial movements, and
                  administrative changes.
                </li>
                <li>
                  To send notifications you have opted to receive, subject to documented
                  mandatory policies.
                </li>
                <li>
                  To provide support, investigate incidents, and improve platform reliability.
                </li>
              </ul>
            </Section>

            <Section title="How we protect information">
              <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground">
                <li>
                  Exchange credentials and other secrets are encrypted at rest using managed
                  encryption keys.
                </li>
                <li>
                  Sensitive values are masked or excluded from application logs, error
                  responses, and analytics events.
                </li>
                <li>
                  Session tokens, MFA secrets, and webhook signing secrets are never exposed
                  after creation.
                </li>
                <li>
                  Access to administrative tools is permission-controlled, step-up
                  authenticated for sensitive operations, and audited.
                </li>
                <li>
                  Audit records are append-only at the application level with integrity
                  verification.
                </li>
              </ul>
            </Section>

            <Section title="Data retention">
              <p>
                We retain information for as long as required to operate the platform and to
                satisfy applicable legal, accounting, and audit obligations. Different data
                categories have different retention periods. Financial, audit, and execution
                records are preserved for the periods required by policy; user-facing
                notification history and other short-lived data are retained for shorter
                periods.
              </p>
            </Section>

            <Section title="Sharing">
              <p>
                We do not sell personal information. We share information only with service
                providers who help us operate the platform (such as payment providers and
                email delivery providers) and only to the extent necessary for the service
                they provide. We may disclose information if required by law.
              </p>
            </Section>

            <Section title="Your controls">
              <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground">
                <li>You can view and update your profile information at any time.</li>
                <li>
                  You can revoke sessions, remove trusted devices, and change security settings
                  from the Security page.
                </li>
                <li>
                  You can revoke exchange connections, disable workspace sharing grants, and
                  remove automations that would otherwise use them.
                </li>
                <li>
                  You can request account deletion. Certain records required for audit or
                  legal purposes are retained under explicit policy.
                </li>
              </ul>
            </Section>

            <Section title="Contact">
              <p>
                For privacy questions, contact{' '}
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
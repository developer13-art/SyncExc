import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, HelpCircle } from 'lucide-react';

import { billingApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/Accordion.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { cn } from '../../lib/utils/cn.util.js';
import { ROUTES } from '../../config/routes.config.js';
import { Link } from 'react-router-dom';

const FAQ_ITEMS = [
  {
    q: 'How is the subscription billed?',
    a: 'SyncExc uses a monthly subscription model. Each plan defines the features, usage limits, and service capabilities available to your account or workspace.',
  },
  {
    q: 'What happens if a payment fails?',
    a: 'Failed renewals trigger configured retries and notifications. During any grace period, paid features remain available; after that, paid access is restricted according to policy. Existing exchange orders and positions are not affected.',
  },
  {
    q: 'Can I change plans?',
    a: 'Yes. Upgrades and downgrades follow a defined effective date and proration policy. Existing records and configurations are preserved — exceeding the new plan\'s limits does not delete your data.',
  },
  {
    q: 'Do subscription limits affect trading safety?',
    a: 'No. A subscription payment does not automatically authorize every feature, and a subscription limit never overrides mandatory platform restrictions, exchange capabilities, or risk controls.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Trials are offered only where the platform explicitly configures them. If a trial is active, it displays on your billing page with its exact end date.',
  },
  {
    q: 'How are refunds handled?',
    a: 'Refund requests are reviewed against the applicable policy. An approved refund is only considered completed after the payment provider confirms it. Refund approval and refund completion are distinct states.',
  },
];

export default function Pricing() {
  const [billingInterval] = useState('monthly');

  const plansQuery = useQuery({
    queryKey: queryKeys.billing.plans({ interval: billingInterval }),
    queryFn: () => billingApi.listPlans({ interval: billingInterval }),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Choose the plan that fits your operations
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Every plan includes the platform's safety model. Paid features scale with your
          usage — they never weaken authorization or risk boundaries.
        </p>
      </div>

      {plansQuery.isLoading ? (
        <div className="mt-16">
          <LoadingState label="Loading plans" />
        </div>
      ) : plansQuery.isError ? (
        <div className="mt-16">
          <ErrorState
            title="Unable to load plans"
            description="We could not fetch the current plan catalog. Please try again."
            onRetry={() => plansQuery.refetch()}
          />
        </div>
      ) : (
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {(plansQuery.data ?? []).map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                'flex flex-col',
                plan.recommended && 'border-primary shadow-md',
              )}
            >
              {plan.recommended ? (
                <div className="rounded-t-lg border-b border-primary/20 bg-primary/5 px-5 py-2 text-center text-xs font-semibold uppercase tracking-wide text-primary">
                  Recommended
                </div>
              ) : null}

              <div className="flex-1 p-6">
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                {plan.description ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{plan.description}</p>
                ) : null}

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-foreground">
                    {formatCurrency(plan.price, plan.currency, { showSymbol: true })}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                {plan.trialDays ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Includes {plan.trialDays}-day trial where available
                  </p>
                ) : null}

                <Button className="mt-6 w-full" asChild>
                  <Link to={ROUTES.auth.register} state={{ planId: plan.id }}>
                    Get started
                  </Link>
                </Button>

                {plan.features?.length > 0 ? (
                  <ul className="mt-6 flex flex-col gap-2.5">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span className="text-foreground">
                          {feature.label ?? feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <section className="mt-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Common questions about billing, plans, and platform behavior.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <Accordion type="single" collapsible>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}
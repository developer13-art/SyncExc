import { Check } from 'lucide-react';

import { Card, CardContent, CardHeader } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function PlanCard({ plan, isCurrent = false, onSelect, ctaLabel, className }) {
  if (!plan) {
    return null;
  }

  return (
    <Card
      className={cn(
        'flex flex-col',
        plan.recommended && !isCurrent && 'border-primary/50 shadow-md',
        isCurrent && 'border-primary shadow-md',
        className,
      )}
    >
      {plan.recommended && !isCurrent ? (
        <div className="rounded-t-lg border-b border-primary/20 bg-primary/5 px-5 py-2 text-center text-xs font-semibold uppercase tracking-wide text-primary">
          Recommended
        </div>
      ) : null}
      {isCurrent ? (
        <div className="rounded-t-lg border-b border-primary/20 bg-primary/5 px-5 py-2 text-center text-xs font-semibold uppercase tracking-wide text-primary">
          Current plan
        </div>
      ) : null}

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold text-foreground">{plan.name}</p>
            {plan.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
            ) : null}
          </div>
          {plan.status === 'retired' ? <Badge variant="muted">Retired</Badge> : null}
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-semibold text-foreground">
            {formatCurrency(plan.price, plan.currency, { showSymbol: true })}
          </span>
          <span className="text-sm text-muted-foreground">
            /{plan.billingInterval ?? 'month'}
          </span>
        </div>
        {plan.trialDays ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Includes {plan.trialDays}-day trial where available
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="flex-1">
        {plan.features?.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-foreground">{feature.label ?? feature}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>

      {onSelect ? (
        <div className="border-t border-border p-5">
          <Button
            onClick={() => onSelect(plan)}
            disabled={isCurrent}
            className="w-full"
            variant={isCurrent ? 'outline' : 'default'}
          >
            {isCurrent ? 'Current plan' : (ctaLabel ?? 'Select plan')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
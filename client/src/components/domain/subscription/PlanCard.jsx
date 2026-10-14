import { Check } from 'lucide-react';

import { Card, CardContent, CardHeader } from '../../ui/Card.jsx';
import { Button } from '../../ui/Button.jsx';
import { Badge } from '../../ui/Badge.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function PlanCard({
  plan,
  isCurrent = false,
  onSelect,
  className,
}) {
  if (!plan) {
    return null;
  }

  return (
    <Card
      className={cn(
        'flex flex-col',
        isCurrent && 'border-primary shadow-md',
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold text-foreground">{plan.name}</p>
            {plan.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
            ) : null}
          </div>
          {isCurrent ? <Badge variant="success">Current</Badge> : null}
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-semibold text-foreground">
              {formatCurrency(plan.price, plan.currency, { showSymbol: true })}
            </span>
            <span className="text-sm text-muted-foreground">
              /{plan.billingInterval ?? 'month'}
            </span>
          </div>
        </div>
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
            {isCurrent ? 'Current plan' : 'Select plan'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
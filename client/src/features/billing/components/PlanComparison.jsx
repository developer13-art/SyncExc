import { Check, X } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { cn } from '../../../lib/utils/cn.util.js';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';

export function PlanComparison({ plans = [], currentPlanId, className }) {
  if (plans.length === 0) {
    return null;
  }

  const features = new Set();
  for (const plan of plans) {
    for (const feature of plan.features ?? []) {
      features.add(feature.label ?? feature);
    }
  }

  const featureList = Array.from(features);

  return (
    <Card className={className}>
      <CardContent className="overflow-x-auto scrollbar-thin p-0">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="border-b border-border px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Feature
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  className={cn(
                    'border-b border-border px-4 py-3 text-left text-xs font-medium uppercase tracking-wide',
                    plan.id === currentPlanId
                      ? 'text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <span>{plan.name}</span>
                    <span className="text-2xs font-normal text-muted-foreground">
                      {formatCurrency(plan.price, plan.currency, { showSymbol: true })}
                      /{plan.billingInterval ?? 'month'}
                    </span>
                    {plan.id === currentPlanId ? (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs text-primary">
                        Current
                      </span>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureList.map((feature) => (
              <tr key={feature} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-xs text-foreground">{feature}</td>
                {plans.map((plan) => {
                  const included = (plan.features ?? []).some(
                    (f) => (f.label ?? f) === feature,
                  );
                  return (
                    <td key={plan.id} className="px-4 py-2.5">
                      {included ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
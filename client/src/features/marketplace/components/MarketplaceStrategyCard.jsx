import { ArrowUpRight, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { ROUTES } from '../../../config/routes.config.js';

export function MarketplaceStrategyCard({ strategy }) {
  const pricing = strategy.pricing;
  const price = pricing
    ? Number(pricing.amountMinor) === 0
      ? 'Free'
      : `${formatCurrency(Number(pricing.amountMinor) / 100, pricing.currency)} / ${pricing.billingInterval || 'month'}`
    : 'No plan required';

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="flex h-full flex-col gap-4 p-4 pt-4 sm:p-5 sm:pt-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Workflow className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold text-foreground">{strategy.name}</h3>
              <Badge variant="muted">{strategy.category}</Badge>
            </div>
            <Link
              to={ROUTES.app.marketplace.provider(strategy.providerId)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Avatar
                src={strategy.providerAvatarUrl}
                fallback={strategy.providerName?.slice(0, 1) || 'T'}
                size="xs"
              />
              {strategy.providerName || 'Trader'}
            </Link>
          </div>
        </div>

        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {strategy.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {(strategy.supportedMarkets || []).map((market) => (
            <Badge key={market} variant="outline">{market}</Badge>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{strategy.followerCount}</strong> followers</span>
            <span><strong className="text-foreground">{strategy.deploymentCount}</strong> deployments</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{price}</p>
            <Button asChild size="sm" className="mt-2">
              <Link to={ROUTES.app.marketplace.strategy(strategy.id)}>
                View strategy <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

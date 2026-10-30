import { Link } from 'react-router-dom';

import { ROUTES } from '../../../config/routes.config.js';
import { cn } from '../../../lib/utils/cn.util.js';

const ITEMS = [
  { id: 'discover', label: 'Discover', to: ROUTES.app.marketplace.browse },
  { id: 'traders', label: 'Traders', to: ROUTES.app.marketplace.traders },
  { id: 'strategies', label: 'Strategies', to: ROUTES.app.marketplace.strategies },
  { id: 'signals', label: 'Signal Providers', to: ROUTES.app.marketplace.signalProviders },
  { id: 'copy', label: 'Copy Trading', to: ROUTES.app.marketplace.copyConfigurations },
  { id: 'watchlist', label: 'Watchlist', to: ROUTES.app.marketplace.watchlist },
];

export function MarketplaceNavigation({ active }) {
  return (
    <nav
      aria-label="Marketplace sections"
      className="flex w-full gap-1 overflow-x-auto border-b border-border"
    >
      {ITEMS.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          aria-current={active === item.id ? 'page' : undefined}
          className={cn(
            'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            active === item.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

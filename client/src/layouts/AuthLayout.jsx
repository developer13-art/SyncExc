import { Link, Outlet } from 'react-router-dom';

import { ROUTES } from '../config/routes.config.js';
import { BrandLogo } from '../components/brand/BrandLogo.jsx';

export function AuthLayout() {
  return (
    <div className="client-auth-shell flex min-h-screen bg-background text-foreground">
      <div className="client-auth-panel hidden w-1/2 flex-col justify-between border-r border-border bg-card p-10 lg:flex">
        <Link to={ROUTES.public.home} className="flex items-center gap-2">
          <BrandLogo className="client-brand-mark h-8 w-8" />
          <span className="text-base font-semibold text-foreground">SyncExc</span>
        </Link>

        <div className="max-w-md">
          <h2 className="text-2xl font-semibold text-foreground">
            Multi-exchange trading, unified.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Connect supported exchanges, mirror eligible activity across authorized accounts,
            interpret signals with AI, and apply consistent risk controls — all in one workspace.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>Authorized synchronization across connected accounts.</li>
            <li>Deterministic validation and pre-trade risk checks.</li>
            <li>Traceable execution with reconciliation.</li>
            <li>Simulation separated from live execution.</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} SyncExc. All rights reserved.
        </p>
      </div>

      <div className="flex w-full flex-1 items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <BrandLogo className="client-brand-mark h-8 w-8" />
            <span className="text-base font-semibold text-foreground">SyncExc</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
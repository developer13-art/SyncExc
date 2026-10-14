import { Link, Outlet } from 'react-router-dom';

import { ROUTES } from '../config/routes.config.js';
import * as Icons from '../assets/icons/index.js';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <div className="hidden w-1/2 flex-col justify-between border-r border-slate-200 bg-white p-10 lg:flex">
        <Link to={ROUTES.public.home} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
            <Icons.LogoIcon className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold text-slate-900">SyncExc</span>
        </Link>

        <div className="max-w-md">
          <h2 className="text-2xl font-semibold text-slate-900">
            Multi-exchange trading, unified.
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Connect supported exchanges, mirror eligible activity across authorized accounts,
            interpret signals with AI, and apply consistent risk controls — all in one workspace.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li>Authorized synchronization across connected accounts.</li>
            <li>Deterministic validation and pre-trade risk checks.</li>
            <li>Traceable execution with reconciliation.</li>
            <li>Simulation separated from live execution.</li>
          </ul>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} SyncExc. All rights reserved.
        </p>
      </div>

      <div className="flex w-full flex-1 items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
              <Icons.LogoIcon className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold text-slate-900">SyncExc</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
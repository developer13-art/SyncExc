import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

import { cn } from '../lib/utils/cn.util.js';
import { PUBLIC_LINKS } from '../lib/constants/route.constants.js';
import { ROUTES } from '../config/routes.config.js';
import { Button } from '../components/ui/Button.jsx';
import * as Icons from '../assets/icons/index.js';

export function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#edf3f8] text-slate-900">
      <div className="border-b border-[#e4e9f0] bg-[#f3dde5] px-3 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2f]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white/50 px-3 py-1.5 text-[11px] text-slate-500 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              localhost:5173
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="rounded-full border border-white/70 bg-white/60 px-2 py-1">Ask Gemini</span>
            <span className="rounded-full border border-white/70 bg-white/60 px-2 py-1">+</span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f4f7fb]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <Link to={ROUTES.public.home} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm shadow-blue-500/30">
              <Icons.LogoIcon className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-900">SyncExc</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {PUBLIC_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm transition',
                    isActive
                      ? 'font-medium text-slate-900'
                      : 'text-slate-500 hover:text-slate-900',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.auth.login}>Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={ROUTES.auth.register}>Get started</Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white/80 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-200 bg-white/90 md:hidden">
            <nav className="flex flex-col px-6 py-3">
              {PUBLIC_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-2 py-2 text-sm transition',
                      isActive
                        ? 'font-medium text-slate-900'
                        : 'text-slate-500 hover:text-slate-900',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={ROUTES.auth.login}>Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to={ROUTES.auth.register}>Get started</Link>
                </Button>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Link to={ROUTES.public.home} className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm shadow-blue-500/30">
                <Icons.LogoIcon className="h-5 w-5" />
              </div>
              <span className="text-base font-semibold text-slate-900">SyncExc</span>
            </Link>
            <p className="mt-3 text-sm text-slate-600">
              Unified multi-exchange cryptocurrency trading operations, signal intelligence,
              and automation.
            </p>
          </div>
          <div className="flex gap-12">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
                Product
              </p>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li>
                  <Link to={ROUTES.public.features} className="hover:text-slate-900">
                    Features
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.public.pricing} className="hover:text-slate-900">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.public.faq} className="hover:text-slate-900">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
                Company
              </p>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li>
                  <Link to={ROUTES.public.about} className="hover:text-slate-900">
                    About
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.public.contact} className="hover:text-slate-900">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-900">
                Legal
              </p>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li>
                  <Link to={ROUTES.public.privacy} className="hover:text-slate-900">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.public.terms} className="hover:text-slate-900">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 py-4">
          <p className="text-center text-xs text-slate-500">
            © {new Date().getFullYear()} SyncExc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
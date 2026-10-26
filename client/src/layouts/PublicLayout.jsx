import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';

import { cn } from '../lib/utils/cn.util.js';
import { ROUTES } from '../config/routes.config.js';
import { Button } from '../components/ui/Button.jsx';
import * as Icons from '../assets/icons/index.js';

const PRIMARY_LINKS = [
  { label: 'Home', path: ROUTES.public.home, end: true },
  { label: 'Markets', path: `${ROUTES.public.home}#market-preview`, hashAnchor: true },
  { label: 'Trading', path: ROUTES.app.terminal.overview },
  { label: 'Copy Trading', path: ROUTES.app.marketplace.browse },
  { label: 'Signals', path: ROUTES.app.signals.overview },
  { label: 'Pricing', path: ROUTES.public.pricing },
];

const RESOURCE_LINKS = [
  { label: 'Features', path: ROUTES.public.features },
  { label: 'About', path: ROUTES.public.about },
  { label: 'Contact', path: ROUTES.public.contact },
  { label: 'FAQ', path: ROUTES.public.faq },
  { label: 'Privacy', path: ROUTES.public.privacy },
  { label: 'Terms', path: ROUTES.public.terms },
];

export function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="client-public-shell flex min-h-screen flex-col bg-background text-foreground">
      <header className="client-public-header sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to={ROUTES.public.home} className="flex items-center gap-2">
            <div className="client-brand-mark flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
              <Icons.LogoIcon className="h-8 w-8" />
            </div>
            <span className="text-base font-semibold tracking-tight text-foreground">SyncExc</span>
          </Link>

          <nav className="client-public-nav hidden items-center gap-1 md:flex">
            {PRIMARY_LINKS.map((link) =>
              link.hashAnchor ? (
                <a
                  key={link.path}
                  href={link.path}
                  className="client-nav-item rounded-md px-2.5 py-2 text-xs text-muted-foreground transition hover:text-foreground lg:px-3 lg:text-sm"
                >
                  {link.label}
                </a>
              ) : (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'client-nav-item rounded-md px-2.5 py-2 text-xs transition lg:px-3 lg:text-sm',
                      isActive
                        ? 'client-nav-active font-medium text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ),
            )}
            <details className="client-resources-menu relative">
              <summary className="client-nav-item flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-2 text-xs text-muted-foreground transition hover:text-foreground lg:px-3 lg:text-sm">
                Resources <ChevronDown className="h-3.5 w-3.5" />
              </summary>
              <div className="client-resources-dropdown">
                {RESOURCE_LINKS.map((link) => (
                  <Link key={link.path} to={link.path} className="client-resource-link">
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
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
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-border bg-card/95 md:hidden">
            <nav className="client-mobile-nav flex flex-col px-6 py-3">
              {PRIMARY_LINKS.map((link) =>
                link.hashAnchor ? (
                  <a
                    key={link.path}
                    href={link.path}
                    onClick={() => setMobileOpen(false)}
                    className="client-mobile-nav-item rounded-md px-2 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ) : (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    end={link.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'client-mobile-nav-item rounded-md px-2 py-2 text-sm transition',
                        isActive
                          ? 'font-medium text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                ),
              )}
              <details className="client-mobile-resources">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-2 text-sm text-muted-foreground">
                  Resources <ChevronDown className="h-4 w-4" />
                </summary>
                {RESOURCE_LINKS.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </details>
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

      <footer className="client-public-footer border-t border-border bg-card/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:justify-between md:py-10">
          <div className="max-w-sm">
            <Link to={ROUTES.public.home} className="flex items-center gap-2">
              <div className="client-brand-mark flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
                <Icons.LogoIcon className="h-8 w-8" />
              </div>
              <span className="text-base font-semibold text-foreground">SyncExc</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Unified multi-exchange cryptocurrency trading operations, signal intelligence,
              and automation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:flex sm:gap-12">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                Product
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>
                  <Link to={ROUTES.public.features} className="hover:text-foreground">
                    Features
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.public.pricing} className="hover:text-foreground">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.public.faq} className="hover:text-foreground">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                Company
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>
                  <Link to={ROUTES.public.about} className="hover:text-foreground">
                    About
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.public.contact} className="hover:text-foreground">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                Legal
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>
                  <Link to={ROUTES.public.privacy} className="hover:text-foreground">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.public.terms} className="hover:text-foreground">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-border py-4">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} SyncExc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
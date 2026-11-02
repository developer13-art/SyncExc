import { BarChart3, Home, MoreHorizontal, Users, Wallet } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { ROUTES } from '../../config/routes.config.js';
import { selectMobileNavOpen, uiActions } from '../../app/slices/uiSlice.js';

const NAV_ITEMS = [
  { label: 'Home', path: ROUTES.app.dashboard, icon: Home },
  { label: 'Community', path: ROUTES.app.community.overview, icon: Users },
  { label: 'Trade', path: ROUTES.app.terminal.overview, icon: BarChart3 },
  { label: 'Earnings', path: ROUTES.app.referral.dashboard, icon: Wallet },
];

function isActivePath(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function MobileBottomNav() {
  const dispatch = useDispatch();
  const location = useLocation();
  const mobileNavOpen = useSelector(selectMobileNavOpen);

  return (
    <nav className="app-mobile-bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
        const active = isActivePath(location.pathname, path);
        return (
          <NavLink
            key={path}
            to={path}
            aria-current={active ? 'page' : undefined}
            className={`app-mobile-bottom-nav-item${active ? ' is-active' : ''}`}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        );
      })}
      <button
        type="button"
        className={`app-mobile-bottom-nav-item${mobileNavOpen ? ' is-active' : ''}`}
        onClick={() =>
          dispatch(
            mobileNavOpen ? uiActions.closeMobileNav() : uiActions.openMobileNav(),
          )
        }
        aria-expanded={mobileNavOpen}
        aria-controls="app-sidebar"
      >
        <MoreHorizontal aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}

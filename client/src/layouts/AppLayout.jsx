import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { Sidebar } from './components/Sidebar.jsx';
import { Topbar } from './components/Topbar.jsx';
import { cn } from '../lib/utils/cn.util.js';
import { selectMobileNavOpen, uiActions } from '../app/slices/uiSlice.js';

export function AppLayout() {
  const dispatch = useDispatch();
  const location = useLocation();
  const mobileNavOpen = useSelector(selectMobileNavOpen);

  useEffect(() => {
    const main = document.querySelector('main[data-app-main]');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'instant' });
    }
    dispatch(uiActions.closeMobileNav());
  }, [dispatch, location.pathname]);

  return (
    <div className="client-app-shell flex min-h-screen min-w-0 bg-background text-foreground">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => dispatch(uiActions.closeMobileNav())}
          aria-label="Close navigation menu"
        />
      ) : null}
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main
          data-app-main
          className={cn(
            'client-app-main min-w-0 flex-1 overflow-x-auto overflow-y-auto scrollbar-thin px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8',
          )}
        >
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
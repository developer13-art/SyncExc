import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { Sidebar } from './components/Sidebar.jsx';
import { Topbar } from './components/Topbar.jsx';
import { cn } from '../lib/utils/cn.util.js';

export function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    const main = document.querySelector('main[data-app-main]');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-slate-100">
        <Topbar />
        <main
          data-app-main
          className={cn(
            'flex-1 overflow-y-auto scrollbar-thin bg-slate-100 px-4 py-6 md:px-6 lg:px-8',
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
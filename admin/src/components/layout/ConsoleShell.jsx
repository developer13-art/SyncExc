import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import { AdminSidebar } from './AdminSidebar.jsx';
import { AdminTopbar } from './AdminTopbar.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function ConsoleShell() {
  const location = useLocation();

  useEffect(() => {
    const main = document.querySelector('main[data-console-main]');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  return (
    <div className="admin-console-shell flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main
          data-console-main
          className={cn(
            'admin-console-main flex-1 overflow-y-auto scrollbar-thin px-4 py-6 md:px-6 lg:px-8',
          )}
        >
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
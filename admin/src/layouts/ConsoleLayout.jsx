import { Outlet } from 'react-router-dom';

import { ConsoleShell } from '../components/layout/ConsoleShell.jsx';

export function ConsoleLayout() {
  return (
    <ConsoleShell>
      <Outlet />
    </ConsoleShell>
  );
}
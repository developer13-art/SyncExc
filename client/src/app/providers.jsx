import { TooltipProvider } from '@radix-ui/react-tooltip';

import { ThemeProvider } from '../context/ThemeContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { WorkspaceProvider } from '../context/WorkspaceContext.jsx';
import { NotificationProvider } from '../context/NotificationContext.jsx';
import { UserPreferencesSync } from './UserPreferencesSync.jsx';

export function AppProviders({ children }) {
  return (
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <WorkspaceProvider>
          <UserPreferencesSync />
          <NotificationProvider>
            <TooltipProvider delayDuration={200} skipDelayDuration={300}>
              {children}
            </TooltipProvider>
          </NotificationProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
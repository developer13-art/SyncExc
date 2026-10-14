import { TooltipProvider } from '@radix-ui/react-tooltip';

import { ThemeProvider } from '../context/ThemeContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { WorkspaceProvider } from '../context/WorkspaceContext.jsx';
import { NotificationProvider } from '../context/NotificationContext.jsx';

export function AppProviders({ children }) {
  return (
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <WorkspaceProvider>
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
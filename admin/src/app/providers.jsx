import { TooltipProvider } from '@radix-ui/react-tooltip';

import { ThemeProvider } from '../context/ThemeContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

export function AppProviders({ children }) {
  return (
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          {children}
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import App from './App.jsx';
import { store } from './app/store.js';
import { queryClient } from './app/queryClient.js';
import { AppProviders } from './app/providers.jsx';
import { ErrorBoundary } from './app/ErrorBoundary.jsx';
import { authActions } from './features/auth/authSlice.js';
import { workspaceActions } from './features/settings/workspaceSlice.js';
import { clearDevelopmentDemoSession } from './lib/utils/storage.util.js';

import './index.css';

if (clearDevelopmentDemoSession()) {
  store.dispatch(authActions.logoutFulfilled());
  store.dispatch(workspaceActions.setActiveWorkspace(null));
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found in document');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppProviders>
              <App />
              <Toaster
                position="top-right"
                closeButton
                richColors
                expand={false}
                duration={5000}
                toastOptions={{
                  classNames: {
                    toast: 'font-sans text-sm',
                    description: 'text-muted-foreground',
                  },
                }}
              />
            </AppProviders>
          </BrowserRouter>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
);
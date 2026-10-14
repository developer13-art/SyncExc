import { Suspense } from 'react';

import { LoadingState } from '../components/ui/LoadingState.jsx';
import { AdminRoutes } from '../routes/index.jsx';

export function AdminRouter() {
  return (
    <Suspense fallback={<LoadingState fullScreen label="Loading Administrator Console" />}>
      <AdminRoutes />
    </Suspense>
  );
}
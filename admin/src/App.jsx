import { Suspense } from 'react';
import { useSelector } from 'react-redux';

import { AdminRoutes } from './routes/index.jsx';
import { LoadingState } from './components/ui/LoadingState.jsx';
import { selectIsBootstrapping } from './context/AuthContext.jsx';

function App() {
  const isBootstrapping = useSelector(selectIsBootstrapping);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState label="Loading SyncExc Administrator Console" size="lg" />
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState fullScreen label="Loading" />}>
      <AdminRoutes />
    </Suspense>
  );
}

export default App;
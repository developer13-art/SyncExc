import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { PublicLayout } from '../layouts/PublicLayout.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../features/auth/authSlice.js';

const Home = lazy(() => import('../features/public/Home.jsx'));
const Features = lazy(() => import('../features/public/Features.jsx'));
const Pricing = lazy(() => import('../features/public/Pricing.jsx'));
const About = lazy(() => import('../features/public/About.jsx'));
const Contact = lazy(() => import('../features/public/Contact.jsx'));
const Faq = lazy(() => import('../features/public/Faq.jsx'));
const Privacy = lazy(() => import('../features/public/Privacy.jsx'));
const Terms = lazy(() => import('../features/public/Terms.jsx'));

export function PublicRoutes() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Suspense fallback={<LoadingState />}><Home /></Suspense>} />
        <Route
          path="features"
          element={<Suspense fallback={<LoadingState />}><Features /></Suspense>}
        />
        <Route
          path="pricing"
          element={<Suspense fallback={<LoadingState />}><Pricing /></Suspense>}
        />
        <Route
          path="about"
          element={<Suspense fallback={<LoadingState />}><About /></Suspense>}
        />
        <Route
          path="contact"
          element={<Suspense fallback={<LoadingState />}><Contact /></Suspense>}
        />
        <Route path="faq" element={<Suspense fallback={<LoadingState />}><Faq /></Suspense>} />
        <Route
          path="privacy"
          element={<Suspense fallback={<LoadingState />}><Privacy /></Suspense>}
        />
        <Route
          path="terms"
          element={<Suspense fallback={<LoadingState />}><Terms /></Suspense>}
        />
      </Route>
      <Route
        path="*"
        element={isAuthenticated ? <Navigate to={ROUTES.app.dashboard} replace /> : null}
      />
    </Routes>
  );
}
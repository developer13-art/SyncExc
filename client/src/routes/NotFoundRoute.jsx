import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { ROUTES } from '../config/routes.config.js';

export function NotFoundRoute() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <span className="text-2xl font-semibold text-muted-foreground">404</span>
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
        The page you are looking for does not exist or has been moved. Please check the URL or
        return to the dashboard.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link to={ROUTES.app.dashboard}>Go to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.public.home}>Go to homepage</Link>
        </Button>
      </div>
    </div>
  );
}
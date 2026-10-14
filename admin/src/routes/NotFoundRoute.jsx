import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { ROUTES } from '../config/routes.config.js';

export function NotFoundRoute() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <span className="text-2xl font-semibold text-muted-foreground">404</span>
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="mb-8 max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or has been moved. Please check the URL or
        return to the overview.
      </p>
      <Button asChild>
        <Link to={ROUTES.console.overview}>Back to overview</Link>
      </Button>
    </div>
  );
}
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { ROUTES } from '../../config/routes.config.js';

export default function Logout() {
  const navigate = useNavigate();
  const { logout } = useAuthContext();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await logout();
      if (!cancelled) {
        navigate(ROUTES.auth.login, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [logout, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <LogOut className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">Signing you out…</p>
      <LoadingState label="" className="py-0" />
      <Button variant="outline" asChild>
        <Link to={ROUTES.auth.login}>Sign in again</Link>
      </Button>
    </div>
  );
}
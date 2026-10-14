import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Building2,
  KeyRound,
  Shield,
  Sparkles,
} from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STEPS = [
  {
    icon: Building2,
    title: 'Set up your workspace',
    description:
      'Personal workspaces are created automatically. Create an organization workspace if you need team collaboration.',
  },
  {
    icon: KeyRound,
    title: 'Connect an exchange',
    description:
      'Authorize a supported exchange with restricted API credentials. Withdrawals are never requested.',
  },
  {
    icon: Shield,
    title: 'Configure risk policies',
    description:
      'Define order limits, position limits, and exposure rules. Every consequential operation passes through the same risk engine.',
  },
  {
    icon: Activity,
    title: 'Add signal sources or automate',
    description:
      'Register supported sources, build workflows, and coordinate eligible operations across your accounts.',
  },
];

export default function Welcome() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Welcome to SyncExc'));
    dispatch(uiActions.setBreadcrumbs([]));
  }, [dispatch]);

  const firstName = (user?.displayName ?? user?.email ?? 'there').split(' ')[0];

  return (
    <div className="flex min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome, {firstName}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Let's get your SyncExc workspace ready.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <p className="text-sm text-muted-foreground">
              SyncExc coordinates exchange connections, signal intelligence, and authorized
              automation behind consistent risk controls. Before you begin, here is what the
              platform will and will not do:
            </p>

            <ul className="mt-4 flex flex-col gap-2 text-sm">
              <Point>Authorize only what you intend to use.</Point>
              <Point>Every consequential operation is subject to authorization, entitlement, capability, and risk checks.</Point>
              <Point>
                Simulation is isolated from live execution. There is no one-click pathway from a
                simulated order to a live one.
              </Point>
              <Point>
                We do not collect identity documents, request withdrawal permissions, or promise
                trading outcomes.
              </Point>
            </ul>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Card key={step.title}>
                <CardContent className="flex items-start gap-3 p-4 pt-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Step {index + 1}
                      </p>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link to={ROUTES.app.dashboard}>Skip for now</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={ROUTES.public.features}>Explore features</Link>
            </Button>
            <Button onClick={() => navigate(ROUTES.onboarding.flow)}>
              Start setup <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Point({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
      <span className="text-foreground">{children}</span>
    </li>
  );
}
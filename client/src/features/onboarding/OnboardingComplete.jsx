import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  Shield,
} from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const NEXT_STEPS = [
  {
    icon: KeyRound,
    title: 'Complete your first connection',
    description:
      'Finish credential entry and validation for the exchange you started during onboarding.',
    to: ROUTES.app.connections.overview,
  },
  {
    icon: Shield,
    title: 'Review risk policies',
    description:
      'Confirm or customize the default policies that will gate every consequential operation.',
    to: ROUTES.app.risk.policies,
  },
  {
    icon: Building2,
    title: 'Invite team members',
    description:
      'Add collaborators to your organization workspace and assign roles appropriate to their responsibilities.',
    to: ROUTES.app.settings.workspaces,
  },
  {
    icon: BarChart3,
    title: 'Explore the terminal',
    description:
      'Review accounts, positions, and execution status across your connected exchanges.',
    to: ROUTES.app.terminal.overview,
  },
  {
    icon: MessageSquare,
    title: 'Set up support',
    description:
      'If you need help, the Support Portal routes requests to the right team without exposing credentials.',
    to: ROUTES.app.support.overview,
  },
];

export default function OnboardingComplete() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Setup complete'));
    dispatch(uiActions.setBreadcrumbs([]));
  }, [dispatch]);

  const firstName = (user?.displayName ?? 'there').split(' ')[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col px-6 py-16">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            You're all set, {firstName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your workspace is ready. Here are the most common next steps.
          </p>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {NEXT_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.title} className="transition hover:border-primary/40">
                <Link to={step.to} className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button variant="outline" asChild>
            <Link to={ROUTES.public.features}>Read the feature overview</Link>
          </Button>
          <Button onClick={() => navigate(ROUTES.app.dashboard, { replace: true })}>
            Go to dashboard <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
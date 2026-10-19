import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { Stepper } from '../../components/ui/Stepper.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { InfoCallout } from '../../components/ui/InfoCallout.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { useConnections, useExchangeRegistry } from '../../hooks/useConnections.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STEPS = [
  { id: 'workspace', title: 'Workspace' },
  { id: 'connection', title: 'First connection' },
  { id: 'mode', title: 'Execution mode' },
  { id: 'done', title: 'Complete' },
];

const EXECUTION_MODES = [
  {
    value: 'monitor_only',
    label: 'Monitor only',
    description:
      'Observe activity and evaluate proposed actions without submitting live orders. You can change this later.',
  },
  {
    value: 'confirm_before_execution',
    label: 'Confirm before execution',
    description:
      'Prepare eligible operations and require your explicit approval before dispatch. Recommended for new workspaces.',
  },
  {
    value: 'authorized_automation',
    label: 'Authorized automation',
    description:
      'Automatically dispatch eligible operations under active risk controls. Requires verified connections and policies.',
  },
];

export default function OnboardingFlow() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuthContext();
  const { activeWorkspace, createWorkspace, updateWorkspace } = useWorkspaceContext();
  const { createConnection } = useConnections();

  const [step, setStep] = useState('workspace');
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    description: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  });

  const [connectionForm, setConnectionForm] = useState({
    exchangeId: '',
    label: '',
    environment: 'production',
  });

  const [selectedMode, setSelectedMode] = useState('confirm_before_execution');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Onboarding'));
    dispatch(uiActions.setBreadcrumbs([]));
  }, [dispatch]);

  const currentStepIndex = useMemo(() => STEPS.findIndex((s) => s.id === step), [step]);

  const goNext = () => {
    const nextIndex = Math.min(currentStepIndex + 1, STEPS.length - 1);
    setStep(STEPS[nextIndex].id);
    setFormError(null);
  };

  const goBack = () => {
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setStep(STEPS[prevIndex].id);
    setFormError(null);
  };

  const handleCreateWorkspace = async () => {
    setFormError(null);
    if (!workspaceForm.name.trim()) {
      setFormError('Workspace name is required');
      return;
    }
    setSubmitting(true);
    try {
      await createWorkspace({
        name: workspaceForm.name.trim(),
        description: workspaceForm.description.trim() || undefined,
        timezone: workspaceForm.timezone,
        type: 'organization',
      });
      toast.success('Workspace created');
      goNext();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipWorkspace = () => {
    goNext();
  };

  const handleCreateConnection = async () => {
    setFormError(null);
    if (!connectionForm.exchangeId) {
      setFormError('Select an exchange');
      return;
    }
    setSubmitting(true);
    try {
      await createConnection({
        exchangeId: connectionForm.exchangeId,
        label: connectionForm.label.trim() || undefined,
        environment: connectionForm.environment,
      });
      toast.success('Connection created', {
        description: 'Complete credential entry from the Connections page.',
      });
      goNext();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipConnection = () => {
    goNext();
  };

  const handleSaveMode = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      if (activeWorkspace?.id) {
        await updateWorkspace({
          workspaceId: activeWorkspace.id,
          defaultExecutionMode: selectedMode,
        });
      }
      toast.success('Execution mode saved');
      goNext();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const { exchanges: exchangeRegistry, isLoading: exchangeRegistryLoading } = useExchangeRegistry();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-2xl flex-col px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set up SyncExc</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This guided setup covers the essentials. You can skip any step and return to it later
            from Settings.
          </p>
        </div>

        <Stepper steps={STEPS} currentStep={currentStepIndex} />

        <div className="mt-8">
          {step === 'workspace' ? (
            <div className="flex flex-col gap-4">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6 pt-6">
                  <p className="text-sm text-muted-foreground">
                    Your personal workspace already exists. Optionally create an organization
                    workspace for team collaboration.
                  </p>

                  <FormError>{formError}</FormError>

                  <FormField
                    label="Workspace name"
                    htmlFor="onboarding-ws-name"
                    hint="Optional — skip if you only need your personal workspace."
                  >
                    <Input
                      id="onboarding-ws-name"
                      value={workspaceForm.name}
                      onChange={(e) => setWorkspaceForm({ ...workspaceForm, name: e.target.value })}
                      placeholder="Trading Team"
                    />
                  </FormField>

                  <FormField label="Description" htmlFor="onboarding-ws-description">
                    <Textarea
                      id="onboarding-ws-description"
                      rows={2}
                      value={workspaceForm.description}
                      onChange={(e) =>
                        setWorkspaceForm({ ...workspaceForm, description: e.target.value })
                      }
                      placeholder="Optional"
                    />
                  </FormField>

                  <FormField label="Timezone" htmlFor="onboarding-ws-tz">
                    <Input
                      id="onboarding-ws-tz"
                      value={workspaceForm.timezone}
                      onChange={(e) =>
                        setWorkspaceForm({ ...workspaceForm, timezone: e.target.value })
                      }
                    />
                  </FormField>

                  <div className="flex justify-between gap-2">
                    <Button variant="ghost" onClick={handleSkipWorkspace} disabled={submitting}>
                      Skip this step
                    </Button>
                    <Button onClick={handleCreateWorkspace} disabled={submitting}>
                      {submitting ? 'Creating…' : 'Create workspace'}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : step === 'connection' ? (
            <div className="flex flex-col gap-4">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6 pt-6">
                  <p className="text-sm text-muted-foreground">
                    Select a supported exchange. You'll enter credentials and validate them from the
                    Connections page.
                  </p>

                  <FormError>{formError}</FormError>

                  <FormField label="Exchange" htmlFor="onboarding-exchange" required>
                    <Select
                      value={connectionForm.exchangeId}
                      onValueChange={(v) => setConnectionForm({ ...connectionForm, exchangeId: v })}
                    >
                      <SelectTrigger id="onboarding-exchange" className="mt-1.5">
                        <SelectValue placeholder="Select an exchange" />
                      </SelectTrigger>
                      <SelectContent>
                        {exchangeRegistry.length === 0 ? (
                          <SelectItem value="" disabled>
                            {exchangeRegistryLoading
                              ? 'Loading exchanges…'
                              : 'No exchanges available'}
                          </SelectItem>
                        ) : (
                          exchangeRegistry.map((exchange) => (
                            <SelectItem key={exchange.id} value={exchange.id}>
                              {exchange.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="Connection label" htmlFor="onboarding-conn-label">
                    <Input
                      id="onboarding-conn-label"
                      value={connectionForm.label}
                      onChange={(e) =>
                        setConnectionForm({ ...connectionForm, label: e.target.value })
                      }
                      placeholder="Primary Spot Account"
                    />
                  </FormField>

                  <FormField label="Environment" htmlFor="onboarding-conn-env">
                    <div className="flex gap-2">
                      {['production', 'testnet'].map((env) => (
                        <Button
                          key={env}
                          type="button"
                          size="sm"
                          variant={connectionForm.environment === env ? 'default' : 'outline'}
                          className="flex-1 capitalize"
                          onClick={() => setConnectionForm({ ...connectionForm, environment: env })}
                        >
                          {env}
                        </Button>
                      ))}
                    </div>
                  </FormField>

                  <InfoCallout>
                    SyncExc never requests withdrawal permissions. Use restricted API keys scoped to
                    the operations you intend to use.
                  </InfoCallout>

                  <div className="flex justify-between gap-2">
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={goBack} disabled={submitting}>
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button variant="ghost" onClick={handleSkipConnection} disabled={submitting}>
                        Skip this step
                      </Button>
                    </div>
                    <Button onClick={handleCreateConnection} disabled={submitting}>
                      {submitting ? 'Creating…' : 'Create connection'}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : step === 'mode' ? (
            <div className="flex flex-col gap-4">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6 pt-6">
                  <p className="text-sm text-muted-foreground">
                    Choose the default execution mode for your workspace. You can change it later,
                    and the platform's authorization, entitlement, capability, and risk checks apply
                    regardless of mode.
                  </p>

                  <FormError>{formError}</FormError>

                  <ul className="flex flex-col gap-3">
                    {EXECUTION_MODES.map((mode) => {
                      const isSelected = selectedMode === mode.value;
                      return (
                        <li key={mode.value}>
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                              isSelected
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border hover:bg-muted/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name="execution-mode"
                              value={mode.value}
                              checked={isSelected}
                              onChange={() => setSelectedMode(mode.value)}
                              className="mt-0.5 h-4 w-4 border-input text-primary focus:ring-ring"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{mode.label}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {mode.description}
                              </p>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <InfoCallout>
                    No mode bypasses risk controls. Authorized automation requires verified
                    connections and complete policy configuration before it can dispatch.
                  </InfoCallout>

                  <div className="flex justify-between gap-2">
                    <Button variant="ghost" onClick={goBack} disabled={submitting}>
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleSaveMode} disabled={submitting}>
                      {submitting ? 'Saving…' : 'Save and continue'}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <div className="max-w-md">
                  <h2 className="text-lg font-semibold text-foreground">
                    You're ready to explore SyncExc
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    You can revisit any of these steps from Settings at any time. Most functionality
                    is available from the dashboard.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => navigate(ROUTES.onboarding.complete)}>
                    Finish setup
                  </Button>
                  <Button onClick={() => navigate(ROUTES.app.dashboard)}>
                    Go to dashboard <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <Link
                    to={ROUTES.app.connections.overview}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Connections <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Link
                    to={ROUTES.app.risk.policies}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Risk policies <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Link
                    to={ROUTES.app.support.help}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Help center <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { Stepper } from '../../components/ui/Stepper.jsx';
import { CredentialForm } from './components/CredentialForm.jsx';
import { PermissionChecklist } from './components/PermissionChecklist.jsx';
import { connectionsApi } from '../../api/index.js';
import { useExchangeRegistry } from '../../hooks/useConnections.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { cn } from '../../lib/utils/cn.util.js';

const STEPS = [
  { id: 'exchange', title: 'Select exchange' },
  { id: 'credentials', title: 'Enter credentials' },
  { id: 'verify', title: 'Verify permissions' },
  { id: 'complete', title: 'Complete' },
];

export default function ConnectExchange() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState('exchange');
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [label, setLabel] = useState('');
  const [environment, setEnvironment] = useState('live');
  const [credentials, setCredentials] = useState({});
  const [credentialErrors, setCredentialErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [connection, setConnection] = useState(null);
  const [connectionNotice, setConnectionNotice] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Connect Exchange'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Connections', path: ROUTES.app.connections.overview },
        { label: 'Connect', path: ROUTES.app.connections.create },
      ]),
    );
  }, [dispatch]);

  const { exchanges, isLoading: exchangesLoading, error: exchangesError } = useExchangeRegistry();
  const [requirements, setRequirements] = useState([]);
  const [environmentOptions, setEnvironmentOptions] = useState([]);
  const [requirementsError, setRequirementsError] = useState(null);

  useEffect(() => {
    if (!selectedExchange) {
      setRequirements([]);
      setEnvironmentOptions([]);
      setRequirementsError(null);
      return;
    }
    let cancelled = false;
    setRequirementsError(null);
    connectionsApi
      .getConnectionRequirements(selectedExchange.id)
      .then((result) => {
        if (!cancelled) {
          setRequirements(result.requirements ?? result ?? []);
          const options = result.environments ?? [{ value: 'live', label: 'Real account' }];
          setEnvironmentOptions(options);
          setEnvironment((current) =>
            options.some((option) => option.value === current) ? current : 'live',
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRequirements([]);
          setEnvironmentOptions([]);
          setRequirementsError(
            'Exchange connection options could not be loaded. Refresh the page and try again.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedExchange]);

  const currentStepIndex = useMemo(() => STEPS.findIndex((s) => s.id === step), [step]);

  const handleExchangeSelect = (exchange) => {
    setSelectedExchange(exchange);
    setLabel(exchange.defaultLabel ?? exchange.name);
    setConnectionNotice(null);
    setStep('credentials');
  };

  const handleCredentialsChange = (name, value) => {
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setCredentialErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setFormError(null);
  };

  const handleCredentialSubmit = async () => {
    if (requirementsError) {
      setFormError(requirementsError);
      return;
    }
    setFormError(null);
    setCredentialErrors({});

    const missing = requirements
      .filter((r) => r.required !== false && !credentials[r.name])
      .reduce((acc, r) => {
        acc[r.name] = `${r.label ?? r.name} is required`;
        return acc;
      }, {});

    if (Object.keys(missing).length > 0) {
      setCredentialErrors(missing);
      return;
    }

    setSubmitting(true);
    try {
      const created = await connectionsApi.create({
        exchange: selectedExchange.id,
        label: label.trim() || selectedExchange.name,
        environment,
        credentials,
      });

      setConnection(created);
      setPermissions(created.permissions ?? {});
      setStep('verify');
      toast.success('Connection validated', {
        description: 'Review the verified permissions before activating.',
      });
    } catch (error) {
      if (error?.status === 409) {
        let items;
        try {
          ({ items } = await connectionsApi.list());
        } catch (recoveryError) {
          setFormError(
            `${getErrorMessage(error)} Could not check for an already-saved connection: ${getErrorMessage(recoveryError)}`,
          );
          return;
        }
        const existing = items.find(
          (item) =>
            item.label === (label.trim() || selectedExchange.name) &&
            item.exchange === selectedExchange.id &&
            item.environment === environment &&
            !['disconnected', 'revoked'].includes(item.status),
        );

        if (existing) {
          let storedPermissions;
          try {
            storedPermissions = await connectionsApi.getPermissions(existing.id);
          } catch (recoveryError) {
            setFormError(
              `This connection may already be saved, but its permissions could not be loaded: ${getErrorMessage(recoveryError)}`,
            );
            return;
          }
          setConnection(existing);
          setCredentials({});
          setPermissions(
            Object.fromEntries(
              storedPermissions.map((permission) => [
                permission.key,
                permission.verification,
              ]),
            ),
          );
          setConnectionNotice(
            'This connection was already saved. The credentials entered now were not applied; the saved connection is being resumed.',
          );
          setStep('verify');
          toast.info('Existing connection found', {
            description: 'Your newly entered credentials were not applied.',
          });
          return;
        }
      }
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async () => {
    if (!connection) {
      return;
    }
    setSubmitting(true);
    try {
      await connectionsApi.sync(connection.id);
      const testResult = await connectionsApi.test(connection.id);
      if (!testResult.ok) {
        throw new Error(testResult.error || 'Exchange connection test failed.');
      }
      setStep('complete');
      toast.success('Connection activated');
    } catch (error) {
      toast.error('Activation failed', { description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.connections.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <Stepper steps={STEPS} currentStep={currentStepIndex} />
        {connectionNotice ? (
          <div className="mt-4 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
            {connectionNotice}{' '}
            {connection ? (
              <Link
                className="font-medium text-info underline underline-offset-2"
                to={ROUTES.app.connections.details(connection.id)}
              >
                Open connection
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8">
          {step === 'exchange' ? (
            <ExchangeStep
              exchanges={exchanges}
              isLoading={exchangesLoading}
              error={exchangesError}
              onSelect={handleExchangeSelect}
            />
          ) : step === 'credentials' ? (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Configure {selectedExchange.name} connection
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Provide a descriptive label and the credentials for this account. We recommend
                  generating a dedicated API key with minimum required permissions.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Connection label" htmlFor="conn-label" required>
                  <Input
                    id="conn-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Primary Spot Account"
                  />
                </FormField>
                <FormField label="Environment" htmlFor="conn-env">
                  <div className="flex gap-1">
                    {environmentOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={environment === option.value ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setEnvironment(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Use API credentials created for the selected account mode. Demo and testnet
                    credentials are separate from real-account credentials.
                  </p>
                </FormField>
              </div>

              <CredentialForm
                exchangeRequirements={requirements}
                values={credentials}
                errors={credentialErrors}
                onChange={handleCredentialsChange}
                onSubmit={handleCredentialSubmit}
                onCancel={() => setStep('exchange')}
                isSubmitting={submitting}
                formError={formError ?? requirementsError}
              />
            </div>
          ) : step === 'verify' ? (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Verify connection permissions
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review the credentials' actual capabilities as reported by the exchange. If
                  required permissions are missing, you can rotate credentials and revalidate.
                </p>
              </div>

              <Card>
                <CardContent className="p-5 pt-5">
                  <PermissionChecklist permissions={permissions ?? {}} />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('credentials')}
                  disabled={submitting}
                >
                  Rotate credentials
                </Button>
                <Button onClick={handleActivate} disabled={submitting}>
                  {submitting ? 'Activating…' : 'Activate connection'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Connection activated</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {connection?.label ?? 'Your connection'} is ready. Balances, instruments, and
                  account metadata will sync shortly.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(ROUTES.app.connections.overview)}>
                  Back to connections
                </Button>
                <Button
                  onClick={() => navigate(ROUTES.app.connections.details(connection?.id ?? ''))}
                >
                  View connection
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExchangeStep({ exchanges, isLoading, error, onSelect }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (exchanges.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center">
        <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground" role={error ? 'alert' : undefined}>
          {error
            ? 'Exchanges could not be loaded. Check your connection and try again.'
            : 'No exchanges are currently available for connection.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Select an exchange</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a supported exchange to connect. Availability may vary by region and account type.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {exchanges.map((exchange) => (
          <button
            key={exchange.id}
            type="button"
            onClick={() => onSelect(exchange)}
            className={cn(
              'flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition',
              'hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">{exchange.name}</p>
            {exchange.description ? (
              <p className="text-xs text-muted-foreground line-clamp-2">{exchange.description}</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

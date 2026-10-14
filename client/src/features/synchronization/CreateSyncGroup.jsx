import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
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
import { DestinationSelector } from './components/DestinationSelector.jsx';
import { SizingForm } from './components/SizingForm.jsx';
import { useSyncGroups } from '../../hooks/useSync.js';
import { useConnections } from '../../hooks/useConnections.js';
import { synchronizationApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STEPS = [
  { id: 'basics', title: 'Basics' },
  { id: 'source', title: 'Source' },
  { id: 'destinations', title: 'Destinations' },
  { id: 'sizing', title: 'Sizing' },
  { id: 'review', title: 'Review' },
];

export default function CreateSyncGroup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState('basics');
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    sourceAccountId: null,
    destinationAccountIds: [],
    eventTypes: ['fill'],
    sizingPolicy: {
      type: 'proportional',
      scaleFactor: 1,
      roundingPolicy: 'down',
    },
    activationMode: 'monitor_only',
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('New Sync Group'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Synchronization', path: ROUTES.app.synchronization.overview },
        { label: 'New sync group', path: ROUTES.app.synchronization.create },
      ]),
    );
  }, [dispatch]);

  const connectionsQuery = useConnections({ status: 'active' });
  const createGroupMutation = useSyncGroups();

  const accounts = (connectionsQuery.data?.items ?? []).flatMap((c) =>
    (c.accounts ?? []).map((a) => ({
      ...a,
      connectionId: c.id,
      exchangeName: c.exchangeName,
    })),
  );

  const sourceAccounts = accounts.filter((a) => a.id !== form.sourceAccountId);
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validateStep = () => {
    if (step === 'basics') {
      if (!form.name.trim()) {
        setFormError('Group name is required');
        return false;
      }
      if (form.name.trim().length > 64) {
        setFormError('Group name must not exceed 64 characters');
        return false;
      }
      return true;
    }

    if (step === 'source') {
      if (!form.sourceAccountId) {
        setFormError('Please select a source account');
        return false;
      }
      return true;
    }

    if (step === 'destinations') {
      if (form.destinationAccountIds.length === 0) {
        setFormError('Add at least one destination account');
        return false;
      }
      if (form.destinationAccountIds.includes(form.sourceAccountId)) {
        setFormError('Source and destination accounts must differ');
        return false;
      }
      return true;
    }

    if (step === 'sizing') {
      if (!form.sizingPolicy.type) {
        setFormError('Please select a sizing policy');
        return false;
      }
      return true;
    }

    return true;
  };

  const goNext = () => {
    setFormError(null);
    if (!validateStep()) {
      return;
    }
    const nextIndex = Math.min(currentStepIndex + 1, STEPS.length - 1);
    setStep(STEPS[nextIndex].id);
  };

  const goBack = () => {
    setFormError(null);
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setStep(STEPS[prevIndex].id);
  };

  const handleCreate = async () => {
    setFormError(null);

    if (!validateStep()) {
      return;
    }

    setSubmitting(true);
    try {
      const created = await createGroupMutation.createGroup({
        name: form.name.trim(),
        sourceAccountId: form.sourceAccountId,
        destinationAccountIds: form.destinationAccountIds,
        eventTypes: form.eventTypes,
        sizingPolicy: form.sizingPolicy,
        executionMode: form.activationMode,
      });

      toast.success('Sync group created', {
        description: 'Review and activate when ready.',
      });
      navigate(ROUTES.app.synchronization.group(created.id), { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.synchronization.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create a sync group
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define a source account and one or more authorized destination accounts. Each
            destination is evaluated independently before dispatch.
          </p>
        </div>

        <Stepper steps={STEPS} currentStep={currentStepIndex} />

        <div className="mt-8">
          {step === 'basics' ? (
            <div className="flex flex-col gap-4">
              <FormField
                label="Group name"
                htmlFor="group-name"
                required
                hint="A descriptive name to identify this sync configuration."
              >
                <Input
                  id="group-name"
                  autoFocus
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="BTC mirror to Binance"
                />
              </FormField>

              <FormField
                label="Execution mode"
                htmlFor="group-mode"
                hint="You can change this later."
              >
                <Select
                  value={form.activationMode}
                  onValueChange={(v) => updateForm('activationMode', v)}
                >
                  <SelectTrigger id="group-mode" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monitor_only">
                      Monitor only — evaluate without dispatching
                    </SelectItem>
                    <SelectItem value="confirm_before_execution">
                      Confirm before execution — approve each eligible operation
                    </SelectItem>
                    <SelectItem value="authorized_automation">
                      Authorized automation — dispatch under active risk controls
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          ) : step === 'source' ? (
            <div className="flex flex-col gap-4">
              <FormField label="Source account" htmlFor="source-account" required>
                <Select
                  value={form.sourceAccountId ?? ''}
                  onValueChange={(v) => updateForm('sourceAccountId', v)}
                >
                  <SelectTrigger id="source-account" className="mt-1.5">
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.exchangeName} · {a.label ?? a.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="Event types"
                htmlFor="event-types"
                hint="Which source events should trigger this group."
              >
                <div className="mt-1.5 flex flex-col gap-2">
                  {[
                    { value: 'fill', label: 'Confirmed fills' },
                    { value: 'order_accepted', label: 'Order accepted (order-intent mirroring)' },
                    { value: 'position_change', label: 'Position changes' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={form.eventTypes.includes(option.value)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.eventTypes, option.value]
                            : form.eventTypes.filter((v) => v !== option.value);
                          updateForm('eventTypes', next);
                        }}
                        className="h-4 w-4 rounded border-input text-primary"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </FormField>
            </div>
          ) : step === 'destinations' ? (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Authorized destination accounts
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each destination is evaluated independently for permissions, capability, and
                  risk before dispatch.
                </p>
              </div>

              <DestinationSelector
                accounts={sourceAccounts}
                value={form.destinationAccountIds}
                onChange={(ids) => updateForm('destinationAccountIds', ids)}
              />
            </div>
          ) : step === 'sizing' ? (
            <SizingForm
              value={form.sizingPolicy}
              onSubmit={(values) => {
                updateForm('sizingPolicy', values);
                goNext();
              }}
              onCancel={goBack}
              submitLabel="Continue"
            />
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-muted-foreground">
                Review the configuration before creating the group. You can activate it from
                the group detail page when ready.
              </p>

              <Card>
                <CardContent className="flex flex-col gap-3 p-5 pt-5 text-sm">
                  <ReviewRow label="Name" value={form.name} />
                  <ReviewRow
                    label="Source"
                    value={
                      accounts.find((a) => a.id === form.sourceAccountId)?.label ??
                      form.sourceAccountId ??
                      '—'
                    }
                  />
                  <ReviewRow
                    label="Destinations"
                    value={`${form.destinationAccountIds.length} account${
                      form.destinationAccountIds.length !== 1 ? 's' : ''
                    }`}
                  />
                  <ReviewRow label="Event types" value={form.eventTypes.join(', ')} />
                  <ReviewRow
                    label="Sizing policy"
                    value={form.sizingPolicy.type.replace(/_/g, ' ')}
                  />
                  <ReviewRow
                    label="Execution mode"
                    value={form.activationMode.replace(/_/g, ' ')}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={goBack} disabled={submitting}>
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={submitting}>
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? 'Creating…' : 'Create sync group'}
                </Button>
              </div>
            </div>
          )}

          <FormError className="mt-4">{formError}</FormError>

          {step !== 'review' && step !== 'sizing' ? (
            <div className="mt-6 flex justify-between gap-2">
              <Button variant="outline" onClick={goBack} disabled={currentStepIndex === 0}>
                Back
              </Button>
              <Button onClick={goNext}>Continue</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
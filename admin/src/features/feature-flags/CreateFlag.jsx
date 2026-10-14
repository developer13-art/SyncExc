import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { Switch } from '../../components/ui/Switch.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { featureFlagsApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../lib/errors.js';

const FLAG_TYPES = [
  { value: 'release', label: 'Release' },
  { value: 'operational_control', label: 'Operational control' },
  { value: 'experiment', label: 'Experiment' },
  { value: 'emergency_kill_switch', label: 'Emergency kill switch' },
];

export default function CreateFlag() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    key: '',
    description: '',
    type: 'release',
    defaultEnabled: false,
    environment: 'production',
    owningTeam: '',
    relatedModule: '',
    startDate: '',
    expirationDate: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Create Feature Flag'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Feature Flags', path: '/feature-flags' },
        { label: 'New', path: '/feature-flags/new' },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.key.trim()) {
      setError('Flag key is required');
      return;
    }
    if (!/^[a-z0-9_.-]+$/.test(form.key)) {
      setError('Flag key must be lowercase with letters, numbers, dots, dashes, underscores');
      return;
    }

    setSubmitting(true);
    try {
      const created = await featureFlagsApi.create({
        key: form.key.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        defaultEnabled: form.defaultEnabled,
        environment: form.environment,
        owningTeam: form.owningTeam.trim() || undefined,
        relatedModule: form.relatedModule.trim() || undefined,
        startDate: form.startDate || undefined,
        expirationDate: form.expirationDate || undefined,
      });
      toast.success('Feature flag draft created');
      navigate(`/feature-flags/${created.id}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/feature-flags">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create feature flag
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            New flags start inactive. Targeting and rollouts are configured separately and
            evaluated server-side.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormError>{error}</FormError>

              <FormField
                label="Flag key"
                htmlFor="flag-key"
                required
                hint="Stable, unique identifier used in code."
              >
                <Input
                  id="flag-key"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })}
                  placeholder="trading.new_terminal_ui"
                />
              </FormField>

              <FormField label="Description" htmlFor="flag-description">
                <Textarea
                  id="flag-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Type" htmlFor="flag-type" required>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger id="flag-type" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLAG_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Environment" htmlFor="flag-env" required>
                  <Input
                    id="flag-env"
                    value={form.environment}
                    onChange={(e) => setForm({ ...form, environment: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Owning team" htmlFor="flag-team">
                  <Input
                    id="flag-team"
                    value={form.owningTeam}
                    onChange={(e) => setForm({ ...form, owningTeam: e.target.value })}
                    placeholder="Trading"
                  />
                </FormField>
                <FormField label="Related module" htmlFor="flag-module">
                  <Input
                    id="flag-module"
                    value={form.relatedModule}
                    onChange={(e) => setForm({ ...form, relatedModule: e.target.value })}
                    placeholder="Module 05"
                  />
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Start date" htmlFor="flag-start">
                  <Input
                    id="flag-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </FormField>
                <FormField label="Expiration date" htmlFor="flag-expiry">
                  <Input
                    id="flag-expiry"
                    type="date"
                    value={form.expirationDate}
                    onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Default enabled</p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    The fallback value when no targeting rule matches.
                  </p>
                </div>
                <Switch
                  checked={form.defaultEnabled}
                  onCheckedChange={(v) => setForm({ ...form, defaultEnabled: v })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to="/feature-flags">Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create flag'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
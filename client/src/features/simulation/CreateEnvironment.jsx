import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { useSimulationEnvironments } from '../../hooks/useSimulation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const ENVIRONMENT_TYPES = [
  { value: 'paper_trading', label: 'Paper trading' },
  { value: 'historical_backtest', label: 'Historical backtest' },
  { value: 'market_replay', label: 'Market replay' },
  { value: 'workflow_test', label: 'Workflow test' },
  { value: 'synchronization_test', label: 'Synchronization test' },
  { value: 'scenario_test', label: 'Scenario test' },
];

export default function CreateEnvironment() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createEnvironment } = useSimulationEnvironments();

  const [form, setForm] = useState({
    name: '',
    type: 'paper_trading',
    description: '',
    virtualBalance: '10000',
    baseCurrency: 'USD',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('New Environment'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Simulation', path: ROUTES.app.simulation.overview },
        { label: 'Environments', path: ROUTES.app.simulation.environments },
        { label: 'New', path: ROUTES.app.simulation.createEnvironment },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Environment name is required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createEnvironment({
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || undefined,
        virtualBalance: form.virtualBalance,
        baseCurrency: form.baseCurrency,
      });

      toast.success('Environment created');
      navigate(ROUTES.app.simulation.environment(created.id), { replace: true });
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
          <Link to={ROUTES.app.simulation.environments}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create simulation environment
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Environments hold virtual balances and an isolated ledger. They never share
            writable records with live accounts.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormError>{error}</FormError>

              <FormField label="Name" htmlFor="env-name" required>
                <Input
                  id="env-name"
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="BTC swing test"
                />
              </FormField>

              <FormField label="Environment type" htmlFor="env-type" required>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger id="env-type" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Description" htmlFor="env-description">
                <Textarea
                  id="env-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Starting virtual balance"
                  htmlFor="env-balance"
                  hint="Internal simulation record — not a real deposit."
                >
                  <Input
                    id="env-balance"
                    type="text"
                    inputMode="decimal"
                    value={form.virtualBalance}
                    onChange={(e) => setForm({ ...form, virtualBalance: e.target.value })}
                  />
                </FormField>
                <FormField label="Base currency" htmlFor="env-currency">
                  <Input
                    id="env-currency"
                    value={form.baseCurrency}
                    onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to={ROUTES.app.simulation.environments}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create environment'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
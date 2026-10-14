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
import { useDeveloperApplications } from '../../hooks/useDeveloper.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const APPLICATION_TYPES = [
  { value: 'personal', label: 'Personal integration' },
  { value: 'organization', label: 'Organization integration' },
  { value: 'third_party', label: 'Approved third-party product (requires review)' },
];

export default function CreateApplication() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createApplication } = useDeveloperApplications();

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'personal',
    environment: 'sandbox',
    contactEmail: '',
    website: '',
    privacyPolicyUrl: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Register Application'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Developer', path: ROUTES.app.developer.overview },
        {
          label: 'Applications',
          path: ROUTES.app.developer.applications,
        },
        { label: 'New', path: ROUTES.app.developer.createApplication },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Application name is required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createApplication({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        environment: form.environment,
        contactEmail: form.contactEmail.trim() || undefined,
        website: form.website.trim() || undefined,
        privacyPolicyUrl: form.privacyPolicyUrl.trim() || undefined,
      });

      toast.success('Application registered', {
        description: 'Create a credential to start integrating.',
      });
      navigate(ROUTES.app.developer.application(created.id), { replace: true });
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
          <Link to={ROUTES.app.developer.applications}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Register an application
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Applications belong to your account or an organization workspace. They use the same
            identity and workspace model — no separate developer account is needed.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormError>{error}</FormError>

              <FormField label="Application name" htmlFor="app-name" required>
                <Input
                  id="app-name"
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Trading Bot"
                />
              </FormField>

              <FormField label="Description" htmlFor="app-description">
                <Textarea
                  id="app-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this application do?"
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Application type" htmlFor="app-type" required>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                  >
                    <SelectTrigger id="app-type" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICATION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Environment" htmlFor="app-env" required>
                  <Select
                    value={form.environment}
                    onValueChange={(v) => setForm({ ...form, environment: v })}
                  >
                    <SelectTrigger id="app-env" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <FormField label="Contact email" htmlFor="app-contact">
                <Input
                  id="app-contact"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="you@example.com"
                />
              </FormField>

              <FormField label="Website" htmlFor="app-website">
                <Input
                  id="app-website"
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </FormField>

              <FormField label="Privacy policy URL" htmlFor="app-privacy">
                <Input
                  id="app-privacy"
                  type="url"
                  value={form.privacyPolicyUrl}
                  onChange={(e) => setForm({ ...form, privacyPolicyUrl: e.target.value })}
                  placeholder="https://example.com/privacy"
                />
              </FormField>

              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to={ROUTES.app.developer.applications}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Registering…' : 'Register application'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
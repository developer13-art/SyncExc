import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { MultiSelect } from '../../components/forms/MultiSelect.jsx';
import { useSourceDiscovery } from '../../hooks/useSources.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const PLATFORM_OPTIONS = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'api', label: 'External API' },
  { value: 'website', label: 'Website' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'fr', label: 'French' },
  { value: 'ha', label: 'Hausa' },
];

const STYLE_OPTIONS = [
  { value: 'intraday', label: 'Intraday' },
  { value: 'short_term', label: 'Short-term' },
  { value: 'swing', label: 'Swing' },
  { value: 'long_term', label: 'Long-term' },
];

export default function Discovery() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createJob } = useSourceDiscovery();

  const [form, setForm] = useState({
    platforms: ['telegram'],
    languages: ['en'],
    styles: [],
    keywords: '',
    maxCandidates: 25,
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Source Discovery'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Sources', path: ROUTES.app.sources.overview },
        { label: 'Discovery', path: ROUTES.app.sources.discovery },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.platforms.length === 0) {
      setError('Select at least one platform');
      return;
    }

    setSubmitting(true);
    try {
      const job = await createJob({
        platforms: form.platforms,
        languages: form.languages,
        styles: form.styles,
        keywords: form.keywords
          ? form.keywords.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        maxCandidates: Number(form.maxCandidates) || 25,
      });

      toast.success('Discovery job started', {
        description: 'Candidates will appear in the review queue.',
      });
      navigate(ROUTES.app.sources.discoveryJob(job.id), { replace: true });
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
          <Link to={ROUTES.app.sources.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Discover signal sources
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Find candidate sources matching your criteria. Each candidate enters a review
              queue — discovery is not approval.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FormError>{error}</FormError>

          <Card>
            <CardHeader>
              <CardTitle>Discovery filters</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FormField label="Platforms" required>
                <MultiSelect
                  options={PLATFORM_OPTIONS}
                  value={form.platforms}
                  onChange={(v) => setForm({ ...form, platforms: v })}
                  placeholder="Select platforms"
                />
              </FormField>

              <FormField label="Languages">
                <MultiSelect
                  options={LANGUAGE_OPTIONS}
                  value={form.languages}
                  onChange={(v) => setForm({ ...form, languages: v })}
                  placeholder="Select languages"
                />
              </FormField>

              <FormField label="Trading styles">
                <MultiSelect
                  options={STYLE_OPTIONS}
                  value={form.styles}
                  onChange={(v) => setForm({ ...form, styles: v })}
                  placeholder="Any style"
                />
              </FormField>

              <FormField
                label="Keywords"
                htmlFor="discovery-keywords"
                hint="Comma-separated terms to match in source descriptions."
              >
                <Input
                  id="discovery-keywords"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="futures, btc, scalp"
                />
              </FormField>

              <FormField
                label="Maximum candidates"
                htmlFor="discovery-max"
                hint="Cap on the number of candidates returned."
              >
                <Input
                  id="discovery-max"
                  type="text"
                  inputMode="numeric"
                  value={form.maxCandidates}
                  onChange={(e) => setForm({ ...form, maxCandidates: e.target.value })}
                />
              </FormField>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to={ROUTES.app.sources.overview}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              <Search className="h-4 w-4" />
              {submitting ? 'Starting…' : 'Start discovery'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
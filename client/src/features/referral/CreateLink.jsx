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
import { useReferralLinks } from '../../hooks/useReferrals.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CreateLink() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createLink } = useReferralLinks();

  const [form, setForm] = useState({
    name: '',
    campaignId: '',
    description: '',
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('New Referral Link'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
        { label: 'Links', path: ROUTES.app.referral.links },
        { label: 'New', path: ROUTES.app.referral.createLink },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createLink({
        name: form.name.trim(),
        campaignId: form.campaignId || undefined,
        description: form.description.trim() || undefined,
      });

      toast.success('Referral link created');
      navigate(ROUTES.app.referral.links, { replace: true });
      // The created link will appear in the list on refetch.
      void created;
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
          <Link to={ROUTES.app.referral.links}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create a referral link
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Give the link a descriptive name and optionally associate it with a campaign.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormError>{error}</FormError>

              <FormField label="Name" htmlFor="link-name" required>
                <Input
                  id="link-name"
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Twitter — weekly thread"
                />
              </FormField>

              <FormField
                label="Campaign ID"
                htmlFor="link-campaign"
                hint="Optional. Groups related links under a campaign."
              >
                <Input
                  id="link-campaign"
                  value={form.campaignId}
                  onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                />
              </FormField>

              <FormField label="Description" htmlFor="link-description">
                <Textarea
                  id="link-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>

              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to={ROUTES.app.referral.links}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create link'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
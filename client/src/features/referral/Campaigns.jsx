import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import { referralApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Campaigns() {
  const dispatch = useDispatch();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Referral Campaigns'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
        { label: 'Campaigns', path: ROUTES.app.referral.campaigns },
      ]),
    );
  }, [dispatch]);

  const campaignsQuery = useQuery({
    queryKey: queryKeys.referral.campaigns({}),
    queryFn: () => referralApi.listCampaigns({}),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => referralApi.createCampaign(payload),
    onSuccess: () => {
      toast.success('Campaign created');
      setCreateOpen(false);
      setForm({ name: '', description: '' });
      campaignsQuery.refetch();
    },
    onError: (err) =>
      toast.error('Creation failed', { description: getErrorMessage(err) }),
  });

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSubmitting(true);
    createMutation.mutate(
      { name: form.name.trim(), description: form.description.trim() },
      { onSettled: () => setSubmitting(false) },
    );
  };

  const campaigns = campaignsQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Referral Campaigns
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Group related referral links into campaigns for clearer analytics.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      {campaignsQuery.isLoading ? (
        <LoadingState label="Loading campaigns" />
      ) : campaignsQuery.isError ? (
        <ErrorState
          title="Unable to load campaigns"
          description="We could not fetch your campaigns."
          onRetry={campaignsQuery.refetch}
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a campaign to group related referral links."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-semibold text-foreground">
                  {campaign.name}
                </p>
                <Badge variant={campaign.status === 'active' ? 'success' : 'muted'}>
                  {campaign.status ?? 'active'}
                </Badge>
              </div>
              {campaign.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {campaign.description}
                </p>
              ) : null}
              <div className="mt-3 flex gap-3 text-2xs text-muted-foreground">
                <span>{campaign.linkCount ?? 0} links</span>
                <span>{campaign.conversions ?? 0} conversions</span>
              </div>
              {campaign.createdAt ? (
                <p className="mt-2 text-2xs text-muted-foreground">
                  Created {formatRelativeTime(campaign.createdAt)}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create campaign"
        description="Campaigns group related referral links for better analytics."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create campaign'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Name" htmlFor="campaign-name" required>
            <Input
              id="campaign-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Description" htmlFor="campaign-description">
            <Textarea
              id="campaign-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
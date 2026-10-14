import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CopyConfigForm } from './components/CopyConfigForm.jsx';
import { useMarketplaceProvider, useCopyConfigurations } from '../../hooks/useMarketplace.js';
import { useConnections } from '../../hooks/useConnections.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CreateCopyConfiguration() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const providerId = searchParams.get('provider');

  const providerQuery = useMarketplaceProvider(providerId);
  const connectionsQuery = useConnections({ status: 'active' });
  const { createConfiguration } = useCopyConfigurations();

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('New Copy Configuration'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
        {
          label: 'Copy configurations',
          path: ROUTES.app.marketplace.copyConfigurations,
        },
        { label: 'New', path: ROUTES.app.marketplace.createCopyConfiguration },
      ]),
    );
  }, [dispatch]);

  const accounts = (connectionsQuery.data?.items ?? []).flatMap((c) =>
    (c.accounts ?? []).map((a) => ({
      ...a,
      connectionId: c.id,
      exchangeName: c.exchangeName,
    })),
  );

  if (!providerId) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-6 text-sm text-warning">
        Select a provider first. Navigate to the marketplace and choose a provider.
      </div>
    );
  }

  if (providerQuery.isLoading) {
    return <LoadingState label="Loading provider" />;
  }

  const handleSubmit = async (values) => {
    setError(null);
    if (values.destinationAccountIds.length === 0) {
      setError('Add at least one destination account');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createConfiguration({
        providerId,
        planId: values.planId,
        name: values.name.trim(),
        destinationAccountIds: values.destinationAccountIds,
        sizingPolicy: {
          type: values.sizingType,
          value: Number(values.sizingValue),
        },
        executionMode: values.executionMode,
        maxOpenPositions: Number(values.maxOpenPositions) || undefined,
        notes: values.notes?.trim() || undefined,
      });

      toast.success('Copy configuration created', {
        description: 'Review and activate when ready.',
      });
      navigate(ROUTES.app.marketplace.copyConfiguration(created.id), { replace: true });
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
          <Link to={ROUTES.app.marketplace.copyConfigurations}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New copy configuration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure which signals from {providerQuery.provider?.displayName ?? 'this provider'}{' '}
            may be considered for copying, to which destination accounts, and with what sizing.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <CopyConfigForm
              provider={providerQuery.provider}
              providerPlans={providerQuery.plans}
              accounts={accounts}
              onSubmit={handleSubmit}
              onCancel={() => navigate(ROUTES.app.marketplace.copyConfigurations)}
              isSubmitting={submitting}
              formError={error}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, Eye, EyeOff, Send, Store, UsersRound } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { apiConfig } from '../../config/api.config.js';
import { resolveProfileImageUrl } from '../../lib/profile-image-url.js';

const profileKey = (workspaceId) => ['marketplace', 'my-provider', workspaceId];
const signalsKey = (workspaceId) => ['marketplace', 'my-signals', workspaceId];

export default function TraderProfile() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeWorkspace, activeWorkspaceId } = useWorkspaceContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState({
    handle: '',
    displayName: '',
    biography: '',
    methodology: '',
    supportedMarkets: 'spot, futures, perpetual',
    supportedLanguages: 'en',
  });
  const [saving, setSaving] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const coverInput = useRef(null);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Trader Studio'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Trader workspace', path: ROUTES.app.trader.overview },
      { label: 'Public profile', path: ROUTES.app.trader.profile },
    ]));
  }, [dispatch]);

  const providerQuery = useQuery({
    queryKey: profileKey(activeWorkspaceId),
    queryFn: () => marketplaceApi.getMyProvider(),
    enabled: activeWorkspace?.type === 'trader',
  });
  const provider = providerQuery.data ?? null;
  const signalsQuery = useQuery({
    queryKey: signalsKey(activeWorkspaceId),
    queryFn: () => marketplaceApi.listMySignals({ limit: 50 }),
    enabled: activeWorkspace?.type === 'trader' && Boolean(provider),
  });
  const signals = signalsQuery.data?.items ?? [];
  useEffect(() => {
    if (!provider) return;
    setForm({
      handle: provider.handle ?? '',
      displayName: provider.displayName ?? '',
      biography: provider.biography ?? '',
      methodology: provider.methodology ?? '',
      supportedMarkets: (provider.supportedMarkets ?? []).join(', '),
      supportedLanguages: (provider.supportedLanguages ?? []).join(', '),
    });
  }, [provider]);

  if (activeWorkspace?.type !== 'trader') {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <h1 className="text-xl font-semibold text-foreground">Trader workspace required</h1>
          <p className="text-sm text-muted-foreground">
            Public profiles and published signals belong to a Trader workspace. Create or switch
            to one before managing a profile.
          </p>
          <Button asChild className="w-fit">
            <Link to={ROUTES.app.settings.workspaces}>Manage workspaces</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (providerQuery.isLoading) return <LoadingState label="Loading Trader Studio" />;
  if (providerQuery.isError) {
    return (
      <ErrorState
        title="Trader workspace unavailable"
        description={getErrorMessage(providerQuery.error)}
        onRetry={providerQuery.refetch}
      />
    );
  }

  const updateField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const parseList = (value) => [...new Set(value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))];

  const saveProfile = async (event) => {
    event.preventDefault();
    const supportedMarkets = parseList(form.supportedMarkets);
    const supportedLanguages = parseList(form.supportedLanguages);
    if (!supportedMarkets.length || !supportedLanguages.length) {
      toast.error('Add at least one supported market and language');
      return;
    }
    if (supportedMarkets.some((market) => !['spot', 'futures', 'perpetual'].includes(market))) {
      toast.error('Supported markets must be spot, futures, or perpetual');
      return;
    }
    setSaving(true);
    try {
      if (provider) {
        await marketplaceApi.updateProvider(provider.id, {
          displayName: form.displayName,
          biography: form.biography,
          methodology: form.methodology,
          supportedMarkets,
          supportedLanguages,
        });
      } else {
        await marketplaceApi.createProvider({
          handle: form.handle.trim().toLowerCase(),
          displayName: form.displayName.trim(),
          accountType: 'individual',
          biography: form.biography,
          methodology: form.methodology,
          supportedMarkets,
          supportedLanguages,
        });
      }
      await queryClient.invalidateQueries({ queryKey: profileKey(activeWorkspaceId) });
      toast.success(provider ? 'Trader profile saved' : 'Trader profile created privately');
    } catch (err) {
      toast.error('Profile could not be saved', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const setVisibility = async (visibility) => {
    setSaving(true);
    try {
      await marketplaceApi.publishProviderProfile(provider.id, { visibility });
      await queryClient.invalidateQueries({ queryKey: profileKey(activeWorkspaceId) });
      toast.success(visibility === 'public' ? 'Profile made public' : 'Profile made private');
    } catch (err) {
      toast.error('Visibility could not be changed', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !provider) return;
    setCoverBusy(true);
    try {
      await marketplaceApi.uploadProviderCover(provider.id, file);
      await queryClient.invalidateQueries({ queryKey: profileKey(activeWorkspaceId) });
      toast.success('Trader cover photo updated');
    } catch (err) {
      toast.error('Cover photo upload failed', { description: getErrorMessage(err) });
    } finally {
      setCoverBusy(false);
    }
  };

  const cancelSignal = async (signal) => {
    const reason = window.prompt('Why are you cancelling this signal?', 'Cancelled by trader');
    if (!reason?.trim()) return;
    if (reason.trim().length < 10) {
      toast.error('Please provide a cancellation reason of at least 10 characters');
      return;
    }
    try {
      await marketplaceApi.cancelPublishedSignal(signal.id, { reason: reason.trim() });
      await queryClient.invalidateQueries({ queryKey: signalsKey(activeWorkspaceId) });
      toast.success('Signal cancelled');
    } catch (err) {
      toast.error('Signal could not be cancelled', { description: getErrorMessage(err) });
    }
  };

  const canPublishSignals =
    provider?.visibility === 'public' && provider?.moderationState === 'approved';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trader Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your public profile, publish and manage signals, and review your marketplace status.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={ROUTES.app.trader.overview}>
            Trader dashboard <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Trader Studio sections">
        {[
          ['overview', 'Overview'],
          ['profile', 'Profile'],
          ['signals', 'Signals'],
        ].map(([key, label]) => (
          <Button
            key={key}
            variant={activeTab === key ? 'secondary' : 'ghost'}
            aria-current={activeTab === key ? 'page' : undefined}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </Button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        signalsQuery.isError ? (
          <ErrorState
            title="Trader overview could not be loaded"
            description={getErrorMessage(signalsQuery.error)}
            onRetry={signalsQuery.refetch}
          />
        ) : (
          <TraderOverview
            provider={provider}
            signals={signals}
            signalsLoading={signalsQuery.isLoading}
            onEditProfile={() => setActiveTab('profile')}
            onManageSignals={() => setActiveTab('signals')}
          />
        )
      ) : null}

      {activeTab === 'signals' ? (
        <section className="flex flex-col gap-6" aria-labelledby="trader-signals-title">
          <header>
            <h2 id="trader-signals-title" className="text-xl font-semibold text-foreground">
              Publish and manage signals
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Publishing first verifies and executes the trade on your selected exchange accounts. The marketplace signal is shared only after confirmed fills.
            </p>
          </header>
          {!provider ? (
            <EmptyState
              icon={Store}
              title="Create your Trader profile first"
              description="You need a Trader profile before you can publish marketplace signals."
              action={<Button onClick={() => setActiveTab('profile')}>Set up profile</Button>}
            />
          ) : null}
          {provider && !canPublishSignals ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium text-foreground">Signal publishing is not available yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your profile must be approved by marketplace moderation and made public first.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setActiveTab('profile')}>Review profile</Button>
              </CardContent>
            </Card>
          ) : null}
          {provider && canPublishSignals ? (
            <Card>
              <CardHeader>
                <CardTitle>New signal</CardTitle>
                <CardDescription>
                  Select your exchange accounts, set the trade size, and pass live pre-flight checks before publishing.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-sm text-muted-foreground">
                  All selected accounts must pass exchange, market, asset, protection, and balance checks. Your order size and account allocations remain private.
                </p>
                <Button asChild>
                  <Link to={ROUTES.app.trader.publishSignal}>
                    <Send className="h-4 w-4" /> Open signal publisher
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {provider ? (
            <Card>
              <CardHeader>
                <CardTitle>Your signals</CardTitle>
                <CardDescription>Recent published signals and their current lifecycle status.</CardDescription>
              </CardHeader>
              <CardContent>
                {signalsQuery.isError ? (
                  <ErrorState title="Signals could not be loaded" description={getErrorMessage(signalsQuery.error)} onRetry={signalsQuery.refetch} />
                ) : signalsQuery.isLoading ? (
                  <LoadingState label="Loading your signals" />
                ) : signals.length === 0 ? (
                  <EmptyState icon={Activity} title="No signals yet" description="Signals you publish will appear here." />
                ) : (
                  <div className="divide-y divide-border">
                    {signals.map((signal) => (
                      <div key={signal.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{signal.instrument}</span>
                            <Badge variant={signal.direction === 'long' ? 'success' : 'destructive'}>{signal.direction}</Badge>
                            <Badge variant={signal.status === 'published' || signal.status === 'updated' ? 'info' : 'muted'}>{signal.status.replaceAll('_', ' ')}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {signal.marketType} · {signal.entry ? `Entry ${signal.entry}` : signal.entryRange ? `Range ${signal.entryRange.min}–${signal.entryRange.max}` : 'No entry specified'}
                            {signal.stopLoss ? ` · SL ${signal.stopLoss}` : ''}
                            {signal.createdAt ? ` · ${new Date(signal.createdAt).toLocaleString()}` : ''}
                          </p>
                        </div>
                        {['published', 'updated'].includes(signal.status) ? (
                          <Button variant="outline" size="sm" onClick={() => cancelSignal(signal)}>Cancel signal</Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'profile' ? (
      <section className="flex flex-col gap-6">
      {provider ? (
        <Card>
          <CardHeader>
            <CardTitle>Trader cover photo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {provider.coverImageUrl ? (
              <img
                src={resolveProfileImageUrl(
                  provider.coverImageUrl,
                  apiConfig.baseURL,
                  window.location.origin,
                )}
                alt="Trader profile cover"
                className="h-40 w-full rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                No cover photo uploaded
              </div>
            )}
            <input
              ref={coverInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Choose a trader cover photo"
              onChange={uploadCover}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, or WebP. Maximum file size: 5 MB.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={coverBusy}
                onClick={() => coverInput.current?.click()}
              >
                {coverBusy ? 'Uploading…' : 'Upload cover photo'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{provider ? 'Profile details' : 'Create a profile'}</CardTitle>
            {provider ? (
              <div className="flex items-center gap-2">
                <Badge variant={provider.moderationState === 'approved' ? 'success' : 'outline'}>
                  {provider.moderationState?.replaceAll('_', ' ') ?? 'pending review'}
                </Badge>
                <Badge variant={provider.visibility === 'public' ? 'info' : 'muted'}>
                  {provider.visibility ?? 'private'}
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={saveProfile}>
            {!provider ? (
              <div className="grid gap-2">
                <Label htmlFor="trader-handle">Public handle</Label>
                <Input id="trader-handle" value={form.handle} onChange={updateField('handle')}
                  placeholder="your-trader-name" minLength={3} maxLength={64} required />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="trader-display-name">Display name</Label>
              <Input id="trader-display-name" value={form.displayName}
              onChange={updateField('displayName')} maxLength={100} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trader-biography">Biography</Label>
              <Textarea id="trader-biography" value={form.biography}
                onChange={updateField('biography')} maxLength={4000} rows={4} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trader-methodology">Trading methodology and risk disclosures</Label>
              <Textarea id="trader-methodology" value={form.methodology}
                onChange={updateField('methodology')} maxLength={4000} rows={4} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="trader-markets">Markets</Label>
                <Input id="trader-markets" value={form.supportedMarkets}
                  onChange={updateField('supportedMarkets')} placeholder="spot, futures" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trader-languages">Languages</Label>
                <Input id="trader-languages" value={form.supportedLanguages}
                  onChange={updateField('supportedLanguages')} placeholder="en, fr" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Creating a profile does not perform KYC or change your subscription.
              </p>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : provider ? 'Save profile' : 'Create private profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {provider ? (
        <Card>
          <CardHeader>
            <CardTitle>Profile visibility</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">
                {provider.visibility === 'public' ? 'Listed in the marketplace' : 'Private'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Public publishing requires marketplace approval, a biography and a methodology.
              </p>
            </div>
            {provider.visibility === 'public' ? (
              <Button variant="outline" disabled={saving} onClick={() => setVisibility('private')}>
                <EyeOff className="h-4 w-4" /> Make private
              </Button>
            ) : (
              <Button disabled={saving || provider.moderationState !== 'approved'}
                onClick={() => setVisibility('public')}>
                <Eye className="h-4 w-4" /> Publish profile
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Store className="mt-0.5 h-4 w-4 shrink-0" />
          Profiles start private and require marketplace moderation before becoming public.
        </div>
      )}
      </section>
      ) : null}
    </div>
  );
}

function TraderOverview({ provider, signals, signalsLoading, onEditProfile, onManageSignals }) {
  const profileStatus = provider
    ? `${provider.moderationState?.replaceAll('_', ' ') ?? 'pending review'} · ${provider.visibility ?? 'private'}`
    : 'Not set up';
  const activeSignals = signals.filter((signal) => ['published', 'updated'].includes(signal.status)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <OverviewCard icon={Store} label="Profile" value={profileStatus} />
        <OverviewCard icon={Activity} label="Published signals" value={signalsLoading ? 'Loading…' : String(activeSignals)} />
        <OverviewCard icon={UsersRound} label="Marketplace handle" value={provider ? `@${provider.handle}` : 'Create a profile'} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Trader workspace checklist</CardTitle>
          <CardDescription>Your profile must be approved and public before you can publish marketplace signals.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={onEditProfile}>{provider ? 'Manage Trader profile' : 'Create Trader profile'}</Button>
          <Button variant="outline" onClick={onManageSignals}>Publish or manage signals</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Keep trading controls separate</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Publishing verifies and executes the trader’s selected personal exchange accounts before sharing a signal. Subscriber copy orders remain separate and respect each subscriber’s own account permissions, pre-trade validation, and risk settings.
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewCard({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <Icon className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate font-semibold capitalize text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

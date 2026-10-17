import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Store } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { marketplaceApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const profileKey = (workspaceId) => ['marketplace', 'my-provider', workspaceId];

export default function TraderProfile() {
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeWorkspace, activeWorkspaceId } = useWorkspaceContext();
  const [form, setForm] = useState({
    handle: '',
    displayName: '',
    biography: '',
    methodology: '',
    supportedMarkets: 'spot, futures, perpetual',
    supportedLanguages: 'en',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Trader profile'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Marketplace', path: ROUTES.app.marketplace.browse },
      { label: 'Trader profile', path: ROUTES.app.marketplace.traderProfile },
    ]));
  }, [dispatch]);

  const providerQuery = useQuery({
    queryKey: profileKey(activeWorkspaceId),
    queryFn: () => marketplaceApi.getMyProvider(),
    enabled: activeWorkspace?.type === 'trader',
  });
  const provider = providerQuery.data ?? null;

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

  if (providerQuery.isLoading) return <LoadingState label="Loading Trader profile" />;

  const updateField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const parseList = (value) => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (provider) {
        await marketplaceApi.updateProvider(provider.id, {
          displayName: form.displayName,
          biography: form.biography,
          methodology: form.methodology,
          supportedMarkets: parseList(form.supportedMarkets),
          supportedLanguages: parseList(form.supportedLanguages),
        });
      } else {
        await marketplaceApi.createProvider({
          handle: form.handle.trim().toLowerCase(),
          displayName: form.displayName.trim(),
          accountType: 'individual',
          biography: form.biography,
          methodology: form.methodology,
          supportedMarkets: parseList(form.supportedMarkets),
          supportedLanguages: parseList(form.supportedLanguages),
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trader profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your profile is private until you explicitly publish it. Marketplace visibility does not
          share source credentials or enable copying.
        </p>
      </header>

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
                onChange={updateField('displayName')} maxLength={120} required />
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
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { InfoCallout } from '../../components/ui/InfoCallout.jsx';
import { CredentialList } from './components/CredentialList.jsx';
import { ScopeSelector } from './components/ScopeSelector.jsx';
import { useDeveloperApplication } from '../../hooks/useDeveloper.js';
import { developerApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Credentials() {
  const { applicationId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();

  const appQuery = useDeveloperApplication(applicationId);
  const { application, credentials, isLoading, error } = appQuery;

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCredential, setNewCredential] = useState({
    label: '',
    scopes: [],
    expiresInDays: '',
  });
  const [createdSecret, setCreatedSecret] = useState(null);
  const [revealedId, setRevealedId] = useState(null);

  useEffect(() => {
    if (application) {
      dispatch(uiActions.setPageTitle(`${application.name} · Credentials`));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Developer', path: ROUTES.app.developer.overview },
          { label: 'Applications', path: ROUTES.app.developer.applications },
          {
            label: application.name,
            path: ROUTES.app.developer.application(application.id),
          },
          {
            label: 'Credentials',
            path: ROUTES.app.developer.credentials(application.id),
          },
        ]),
      );
    }
  }, [application, dispatch]);

  if (isLoading) {
    return <LoadingState label="Loading credentials" />;
  }

  if (error || !application) {
    return (
      <ErrorState
        title="Unable to load credentials"
        description="The application or its credentials could not be retrieved."
        onRetry={appQuery.refetch}
      />
    );
  }

  const availableScopes = application.availableScopes ?? [];

  const handleCreate = async () => {
    if (!newCredential.label.trim()) {
      toast.error('Label is required');
      return;
    }
    if (newCredential.scopes.length === 0) {
      toast.error('Select at least one scope');
      return;
    }
    setCreating(true);
    try {
      const created = await developerApi.createCredential(applicationId, {
        label: newCredential.label.trim(),
        scopes: newCredential.scopes,
        expiresInDays: newCredential.expiresInDays
          ? Number(newCredential.expiresInDays)
          : undefined,
      });
      setCreatedSecret(created);
      setCreateOpen(false);
      setNewCredential({ label: '', scopes: [], expiresInDays: '' });
      await appQuery.refetch?.();
    } catch (err) {
      toast.error('Failed to create credential', {
        description: getErrorMessage(err),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRotate = async (credential) => {
    try {
      const result = await appQuery.rotateCredential({
        credentialId: credential.id,
      });
      setCreatedSecret(result);
      toast.success('Credential rotated');
    } catch (err) {
      toast.error('Rotation failed', { description: getErrorMessage(err) });
    }
  };

  const handleRevoke = async (credential) => {
    try {
      await appQuery.revokeCredential(credential.id);
      toast.success('Credential revoked');
    } catch (err) {
      toast.error('Revoke failed', { description: getErrorMessage(err) });
    }
  };

  const handleReveal = (credential) => {
    if (revealedId === credential.id) {
      setRevealedId(null);
      return;
    }
    setRevealedId(credential.id);
    toast.info('Secret preview', {
      description:
        'SyncExc never stores or displays secrets in full after creation. Copy it now if shown.',
    });
  };

  const credentialsWithReveal = credentials.map((c) => ({
    ...c,
    revealedSecret: c.id === revealedId ? c.secret : undefined,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.developer.application(applicationId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            API Credentials
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Credentials receive only the scopes you explicitly grant. Secrets are shown once at
            creation and never displayed again.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create credential
        </Button>
      </div>

      {createdSecret ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-4 pt-4">
            <div>
              <p className="text-sm font-semibold text-warning">
                New credential secret — copy now
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This is the only time the full secret will be displayed. Store it in a secure
                location and never commit it to version control.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {createdSecret.secret}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(createdSecret.secret);
                  toast.success('Copied to clipboard');
                }}
              >
                Copy
              </Button>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreatedSecret(null)}
              >
                I have saved the secret
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CredentialList
        credentials={credentialsWithReveal}
        onRotate={handleRotate}
        onRevoke={handleRevoke}
        onReveal={handleReveal}
      />

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create credential"
        description="Choose only the scopes your integration needs."
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <FormField label="Label" htmlFor="cred-label" required>
            <Input
              id="cred-label"
              value={newCredential.label}
              onChange={(e) =>
                setNewCredential({ ...newCredential, label: e.target.value })
              }
              placeholder="Production integration"
            />
          </FormField>

          <FormField
            label="Expiry (days)"
            htmlFor="cred-expiry"
            hint="Optional. Defaults to no expiration."
          >
            <Input
              id="cred-expiry"
              type="text"
              inputMode="numeric"
              value={newCredential.expiresInDays}
              onChange={(e) =>
                setNewCredential({ ...newCredential, expiresInDays: e.target.value })
              }
              placeholder="90"
            />
          </FormField>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Scopes</p>
            <ScopeSelector
              scopes={availableScopes}
              value={newCredential.scopes}
              onChange={(scopes) =>
                setNewCredential({ ...newCredential, scopes })
              }
            />
          </div>

          <InfoCallout>
            Scopes are necessary but not sufficient. The user's current permissions, workspace
            membership, subscription entitlements, and platform safety policies are also
            evaluated on every request.
          </InfoCallout>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create credential'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
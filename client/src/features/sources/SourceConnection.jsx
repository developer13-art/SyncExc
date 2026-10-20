import { useState } from 'react';
import { CheckCircle2, Plug, RefreshCw, Unplug } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { useSource } from '../../hooks/useSources.js';
import { useToast } from '../../hooks/useToast.js';
import { sourcesApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';
import { TelegramSourceWizard } from './components/TelegramSourceWizard.jsx';

export function SourceConnection({ sourceId }) {
  const toast = useToast();
  const { source, connection, isLoading, refetch } = useSource(sourceId);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reauthorizing, setReauthorizing] = useState(false);

  if (isLoading) return <LoadingState label="Loading connection" />;

  const hasConnection =
    connection?.status === 'active' && connection?.authorizationStatus === 'authorized';

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await sourcesApi.testConnection(sourceId);
      if (result?.reachable === false) {
        toast.error('Connection test failed', {
          description: result.connectivityMessage || 'Telegram could not access this chat.',
        });
      } else {
        toast.success('Telegram connection is healthy');
      }
      await refetch?.();
    } catch (err) {
      toast.error('Test failed', { description: getErrorMessage(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await sourcesApi.disconnectConnection(sourceId);
      toast.success('Telegram disconnected', {
        description: 'Open exchange orders and positions were not changed.',
      });
      await refetch?.();
    } catch (err) {
      toast.error('Could not disconnect Telegram', { description: getErrorMessage(err) });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {!hasConnection ? (
        <Alert
          variant={connection?.authorizationStatus === 'required' ? 'warning' : 'info'}
          title={
            connection?.authorizationStatus === 'required'
              ? 'Telegram sign-in required'
              : 'Telegram account not connected'
          }
        >
          <p className="text-xs">
            {connection?.authorizationStatus === 'required'
              ? 'Telegram needs you to sign in again. Monitoring is paused until you restore the account connection.'
              : 'Connect the real Telegram account that can access this selected channel or group. Bot tokens are not used.'}
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Connection status</CardTitle>
            <Badge variant={hasConnection ? 'success' : 'warning'}>
              {connection?.authorizationStatus === 'required'
                ? 'sign-in required'
                : connection?.status ?? 'not connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Method" value={connection?.method ?? 'Telegram account'} />
          <Field label="Telegram account" value={connection?.metadata?.accountName ?? '—'} />
          <Field
            label="Last validated"
            value={connection?.lastValidatedAt ? formatDateTime(connection.lastValidatedAt) : '—'}
          />
          <Field label="Credential status" value={connection?.credentialStatus ?? '—'} />
        </CardContent>
        {source?.type === 'telegram' ? (
          <CardContent className="flex flex-wrap justify-end gap-2">
            {hasConnection ? (
              <>
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                  {testing ? (
                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing…</>
                  ) : (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Test connection</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  <Unplug className="h-3.5 w-3.5" />
                  {disconnecting ? 'Removing…' : 'Remove selected chat'}
                </Button>
              </>
            ) : source?.status ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReauthorizing((open) => !open)}
              >
                <Plug className="h-3.5 w-3.5" />
                {reauthorizing ? 'Close sign-in' : 'Connect Telegram account'}
              </Button>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      {reauthorizing && source?.type === 'telegram' ? (
        <TelegramSourceWizard
          reauthorizeSourceId={sourceId}
          onCancel={() => setReauthorizing(false)}
          onComplete={async () => {
            setReauthorizing(false);
            toast.success('Telegram account restored');
            await refetch?.();
          }}
        />
      ) : null}

      {!connection && source?.type === 'telegram' ? (
        <div className="text-right">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.app.sources.create}>Add a Telegram source</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

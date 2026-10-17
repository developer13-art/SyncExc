import { useState } from 'react';
import { AlertCircle, CheckCircle2, Plug, RefreshCw } from 'lucide-react';

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
import { Input } from '../../components/ui/Input.jsx';
import { Label } from '../../components/ui/Label.jsx';

export function SourceConnection({ sourceId }) {
  const toast = useToast();
  const { source, connection, isLoading, refetch } = useSource(sourceId);
  const [testing, setTesting] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [botToken, setBotToken] = useState('');

  if (isLoading) {
    return <LoadingState label="Loading connection" />;
  }

  const hasConnection = connection?.status === 'active' && connection?.authorizationStatus === 'authorized';

  const handleTest = async () => {
    setTesting(true);
    try {
      await sourcesApi.testConnection(sourceId);
      toast.success('Connection test completed');
      await refetch?.();
    } catch (err) {
      toast.error('Test failed', { description: getErrorMessage(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleAuthorize = async () => {
    setAuthorizing(true);
    try {
      if (source?.type !== 'telegram' || !botToken.trim()) {
        throw new Error('Enter a Telegram bot token to connect this source.');
      }
      const authResult = await sourcesApi.authorizeConnection(sourceId, {
        credentials: { botToken: botToken.trim() },
      });
      if (authResult?.redirectUrl) {
        window.location.href = authResult.redirectUrl;
      } else {
        toast.success('Authorization initiated');
        setBotToken('');
        await refetch?.();
      }
    } catch (err) {
      toast.error('Authorization failed', { description: getErrorMessage(err) });
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {!hasConnection ? (
        <Alert variant="warning" title="No connection configured">
          {source?.type === 'telegram' ? (
            <>
              <p className="text-xs">
                This connection uses a Telegram bot, not a personal Telegram account. Add the bot
                to the specific channel or group you registered. The app will not enumerate or
                monitor other chats.
              </p>
              <div className="mt-3 grid max-w-md gap-2">
                <Label htmlFor="telegram-bot-token">Telegram bot token</Label>
                <Input
                  id="telegram-bot-token"
                  type="password"
                  autoComplete="new-password"
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  placeholder="Enter token from BotFather"
                />
                <p className="text-xs text-muted-foreground">
                  The token is encrypted before storage and never returned by the API.
                </p>
                <Button size="sm" className="w-fit" onClick={handleAuthorize}
                  disabled={authorizing || !botToken.trim()}>
                  <Plug className="h-3.5 w-3.5" />
                  {authorizing ? 'Connecting…' : 'Connect Telegram bot'}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs">
              This source type does not have an authorized connection flow configured here.
              Monitoring remains off until the provider connection is supported.
            </p>
          )}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Connection status</CardTitle>
            {hasConnection ? (
              <Badge variant={connection.status === 'active' ? 'success' : 'muted'}>
                {connection.status ?? 'unknown'}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Method" value={connection?.method ?? '—'} />
          <Field label="Environment" value={connection?.environment ?? 'production'} />
          <Field
            label="Last validated"
            value={
              connection?.lastValidatedAt ? formatDateTime(connection.lastValidatedAt) : '—'
            }
          />
          <Field
            label="Credential status"
            value={connection?.credentialStatus ?? '—'}
          />
        </CardContent>
        {hasConnection ? (
          <CardContent>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Test connection
                  </>
                )}
              </Button>
              {source?.type === 'telegram' ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid min-w-56 flex-1 gap-1.5">
                    <Label htmlFor="telegram-reauthorize-token">New Telegram bot token</Label>
                    <Input
                      id="telegram-reauthorize-token"
                      type="password"
                      autoComplete="new-password"
                      value={botToken}
                      onChange={(event) => setBotToken(event.target.value)}
                      placeholder="Enter replacement token"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAuthorize}
                    disabled={authorizing || !botToken.trim()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reauthorize
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Reauthorization is unavailable for this source type.
                </p>
              )}
            </div>
          </CardContent>
        ) : null}
      </Card>

      {connection?.permissions ? (
        <Card>
          <CardHeader>
            <CardTitle>Access requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {Object.entries(connection.permissions).map(([key, value]) => (
                <li key={key} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-foreground">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <Badge variant={value === 'granted' ? 'success' : 'warning'}>{value}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
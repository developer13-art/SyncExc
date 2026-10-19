import { useState } from 'react';
import { Check, LoaderCircle, MessageCircle, ShieldCheck } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Checkbox } from '../../../components/ui/Checkbox.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Label } from '../../../components/ui/Label.jsx';
import { InfoCallout } from '../../../components/ui/InfoCallout.jsx';
import { sourcesApi } from '../../../api/index.js';
import { getErrorMessage } from '../../../api/errors.js';

export function TelegramSourceWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loginId, setLoginId] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [emailPattern, setEmailPattern] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await sourcesApi.telegramSendCode(phoneNumber);
      setLoginId(result.loginId);
      setDelivery(result.delivery);
      setEmailPattern(result.emailPattern);
      setStep('code');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!loginId) return;
    setError(null);
    setBusy(true);
    try {
      const result = await sourcesApi.telegramVerifyCode({
        loginId,
        ...(requiresPassword ? { password } : { code }),
      });
      if (result.requiresPassword) {
        setRequiresPassword(true);
        return;
      }
      setStep('channels');
      const listedChannels = await sourcesApi.telegramListChannels(loginId);
      setChannels(listedChannels);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function reloadChannels() {
    if (!loginId) return;
    setError(null);
    setBusy(true);
    try {
      setChannels(await sourcesApi.telegramListChannels(loginId));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  function toggleChannel(id) {
    setSelectedChannels((selected) => {
      if (selected.includes(id)) return selected.filter((item) => item !== id);
      if (selected.length >= 50) {
        setError('You can connect up to 50 Telegram chats at a time.');
        return selected;
      }
      return [...selected, id];
    });
  }

  async function connectChannels() {
    if (!loginId || selectedChannels.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const createdSources = await sourcesApi.telegramCreateSources({
        loginId,
        channelIds: selectedChannels,
      });
      await onComplete(createdSources);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (loginId) {
      try {
        await sourcesApi.telegramCancelLogin(loginId);
      } catch (cancelError) {
        setError(getErrorMessage(cancelError));
        return;
      }
    }
    onCancel?.();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Connect Telegram</h2>
          <p className="text-sm text-muted-foreground">
            Sign in to your Telegram account, then choose the chats to monitor.
          </p>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        {[
          ['phone', 'Phone'],
          ['code', 'Verify'],
          ['channels', 'Choose chats'],
        ].map(([key, label], index) => {
          const active = key === step;
          const complete = ['phone', 'code', 'channels'].indexOf(step) > index;
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  active || complete
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={active ? 'font-medium text-foreground' : ''}>{label}</span>
              {index < 2 ? <span className="mx-1 h-px w-5 bg-border" /> : null}
            </div>
          );
        })}
      </div>

      {step === 'phone' ? (
        <form onSubmit={requestCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telegram-phone">Telegram phone number</Label>
            <Input
              id="telegram-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+12345678900"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Include your country code. Telegram may send the login code inside its app rather than
              by SMS.
            </p>
          </div>
          <InfoCallout>
            SyncExc never asks for your Telegram bot token. Your account session is encrypted on the
            server and is used only to read chats you select.
          </InfoCallout>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !phoneNumber.trim()}>
              {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send login code
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'code' ? (
        <form onSubmit={verifyCode} className="flex flex-col gap-4">
          <InfoCallout>
            {delivery === 'telegram_app'
              ? 'Telegram sent a login code to your Telegram app. Check the verified service chat.'
              : delivery === 'email'
                ? `Telegram sent a login code to your account email${emailPattern ? ` (${emailPattern})` : ''}.`
                : 'Telegram sent a login code by SMS.'}
          </InfoCallout>
          {!requiresPassword ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telegram-code">Telegram login code</Label>
              <Input
                id="telegram-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telegram-password">Telegram two-step verification password</Label>
              <Input
                id="telegram-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                This is your Telegram 2-step verification password, not your login code.
              </p>
            </div>
          )}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
              Cancel setup
            </Button>
            <Button type="submit" disabled={busy || (requiresPassword ? !password : !code)}>
              {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify and continue
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'channels' ? (
        <div className="flex flex-col gap-4">
          <InfoCallout>
            Select the channels or groups SyncExc should monitor. Only new messages are collected
            after you connect them.
          </InfoCallout>
          {busy && channels.length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground" role="status">
              Loading your Telegram chats…
            </p>
          ) : channels.length ? (
            <div className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {channels.map((channel) => (
                <label
                  key={channel.id}
                  className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedChannels.includes(channel.id)}
                    onCheckedChange={() => toggleChannel(channel.id)}
                    aria-label={`Select ${channel.title}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {channel.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {channel.type}
                      {channel.username ? ` · @${channel.username}` : ''}
                    </span>
                  </span>
                  {channel.url ? (
                    <a
                      href={channel.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      View
                    </a>
                  ) : null}
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              No Telegram channels or groups were found for this account.
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Your login code and 2-step password are never stored. The Telegram session is encrypted.
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
              Cancel setup
            </Button>
            <div className="flex gap-2">
              {error ? (
                <Button type="button" variant="outline" onClick={reloadChannels} disabled={busy}>
                  Reload chats
                </Button>
              ) : null}
              <Button onClick={connectChannels} disabled={busy || selectedChannels.length === 0}>
                {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect {selectedChannels.length || ''}{' '}
                {selectedChannels.length === 1 ? 'chat' : 'chats'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TelegramSourceWizard;

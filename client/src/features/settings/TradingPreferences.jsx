import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { SettingsSectionNav } from './components/SettingsSectionNav.jsx';
import { useUserPreferences } from './useUserPreferences.js';

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function TradingPreferences() {
  const dispatch = useDispatch();
  const { query, save, isSaving } = useUserPreferences();
  const [form, setForm] = useState({
    defaultMarketType: 'spot',
    defaultOrderType: 'limit',
    defaultChartTimeframe: '1h',
    signalExecutionPercentage: '',
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Trading preferences'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Settings', path: ROUTES.app.settings.overview },
      { label: 'Trading preferences', path: ROUTES.app.settings.trading },
    ]));
  }, [dispatch]);

  useEffect(() => {
    if (query.data?.trading) {
      setForm({
        defaultMarketType: query.data.trading.defaultMarketType ?? 'spot',
        defaultOrderType: query.data.trading.defaultOrderType ?? 'limit',
        defaultChartTimeframe: query.data.trading.defaultChartTimeframe ?? '1h',
        signalExecutionPercentage: query.data.trading.signalExecutionPercentage == null
          ? ''
          : String(query.data.trading.signalExecutionPercentage),
      });
    }
  }, [query.data?.trading]);

  if (query.isLoading) return <LoadingState label="Loading trading preferences" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Trading preferences unavailable"
        description="Your trading preferences could not be loaded."
        onRetry={query.refetch}
      />
    );
  }

  const initialValues = {
    defaultMarketType: query.data?.trading?.defaultMarketType ?? 'spot',
    defaultOrderType: query.data?.trading?.defaultOrderType ?? 'limit',
    defaultChartTimeframe: query.data?.trading?.defaultChartTimeframe ?? '1h',
    signalExecutionPercentage: query.data?.trading?.signalExecutionPercentage == null
      ? ''
      : String(query.data.trading.signalExecutionPercentage),
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const percentage = Number(form.signalExecutionPercentage);
    if (
      form.signalExecutionPercentage !== '' &&
      (!Number.isFinite(percentage) || percentage < 0.01 || percentage > 100)
    ) return;
    await save({
      trading: {
        ...form,
        signalExecutionPercentage: form.signalExecutionPercentage === ''
          ? null
          : Number(form.signalExecutionPercentage),
      },
    });
  };
  const percentageValue = form.signalExecutionPercentage === ''
    ? null
    : Number(form.signalExecutionPercentage);
  const percentageInvalid = percentageValue !== null &&
    (!Number.isFinite(percentageValue) || percentageValue < 0.01 || percentageValue > 100);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trading preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Terminal defaults never submit orders. Signal execution uses the balance percentage below and remains subject to workspace permissions, exchange capabilities, and risk checks.
        </p>
      </header>
      <SettingsSectionNav activePath={ROUTES.app.settings.trading} />
      <Card>
        <CardHeader>
          <CardTitle>Terminal defaults</CardTitle>
          <CardDescription>Applied when opening the unified trading terminal.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5 sm:max-w-xl" onSubmit={handleSave}>
            <div className="flex flex-col gap-2">
              <label htmlFor="settings-market-type" className="text-sm font-medium text-foreground">Default market</label>
              <Select
                value={form.defaultMarketType}
                onValueChange={(value) => setForm((current) => ({ ...current, defaultMarketType: value }))}
              >
                <SelectTrigger id="settings-market-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spot">Spot</SelectItem>
                  <SelectItem value="futures">Futures</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="settings-signal-execution-percentage" className="text-sm font-medium text-foreground">
                Trader signal execution (% of balance)
              </label>
              <input
                id="settings-signal-execution-percentage"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                inputMode="decimal"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                placeholder="Disabled"
                value={form.signalExecutionPercentage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    signalExecutionPercentage: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                When set, new signals are sized using this share of available balance on every active matching account in this workspace. The exchange must support attached stop-loss and take-profit for that market and order type. Bybit Spot currently supports protected limit entries; unsupported combinations are blocked. Leave blank to disable automatic execution. Risk and permission checks can still block an order or require approval.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="settings-order-type" className="text-sm font-medium text-foreground">Default order type</label>
              <Select
                value={form.defaultOrderType}
                onValueChange={(value) => setForm((current) => ({ ...current, defaultOrderType: value }))}
              >
                <SelectTrigger id="settings-order-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="limit">Limit</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="settings-chart-timeframe" className="text-sm font-medium text-foreground">Default chart timeframe</label>
              <Select
                value={form.defaultChartTimeframe}
                onValueChange={(value) => setForm((current) => ({ ...current, defaultChartTimeframe: value }))}
              >
                <SelectTrigger id="settings-chart-timeframe"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timeframes.map((timeframe) => (
                    <SelectItem key={timeframe} value={timeframe}>{timeframe}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              For connection and account controls, visit{' '}
              <Link className="text-primary underline-offset-4 hover:underline" to={ROUTES.app.connections.overview}>Exchange connections</Link>.
            </p>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving || percentageInvalid ||
                (form.defaultMarketType === initialValues.defaultMarketType &&
                 form.defaultOrderType === initialValues.defaultOrderType &&
                 form.defaultChartTimeframe === initialValues.defaultChartTimeframe &&
                 form.signalExecutionPercentage === initialValues.signalExecutionPercentage)}>
                {isSaving ? 'Saving…' : 'Save preferences'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

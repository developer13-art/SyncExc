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
  };

  const handleSave = async (event) => {
    event.preventDefault();
    await save({ trading: form });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Trading preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These are starting defaults only. They never submit orders or override account permissions, exchange capabilities, entitlements, or risk limits.
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
              Order review remains required by the platform. For connection and account controls, visit{' '}
              <Link className="text-primary underline-offset-4 hover:underline" to={ROUTES.app.connections.overview}>Exchange connections</Link>.
            </p>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving ||
                (form.defaultMarketType === initialValues.defaultMarketType &&
                 form.defaultOrderType === initialValues.defaultOrderType &&
                 form.defaultChartTimeframe === initialValues.defaultChartTimeframe)}>
                {isSaving ? 'Saving…' : 'Save preferences'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

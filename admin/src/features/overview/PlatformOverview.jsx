import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { IconButton } from '../../components/ui/IconButton.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { useToast } from '../../hooks/useToast.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { adminApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queryKeys.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatRelativeTime, formatDate } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

const RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '30d', label: 'Last 30 days' },
];
const PIE_COLORS = ['#1685ff', '#04c89a', '#7b61ff', '#f2aa48', '#ff5470', '#37c8df'];
const panelClass = 'admin-dashboard-panel rounded-lg border border-sky-950 bg-[#061a31]';

export default function PlatformOverview() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Admin Dashboard'));
    dispatch(uiActions.setBreadcrumbs([]));
  }, [dispatch]);

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.get({ timeRange }),
    queryFn: () => adminApi.getDashboard({ timeRange }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const healthQuery = useQuery({
    queryKey: queryKeys.dashboard.health,
    queryFn: () => adminApi.getHealth(),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const handleRefresh = async () => {
    try {
      await Promise.all([dashboardQuery.refetch(), healthQuery.refetch()]);
      toast.success('Dashboard refreshed');
    } catch (err) {
      toast.error('Refresh failed', { description: getErrorMessage(err) });
    }
  };

  if (dashboardQuery.isLoading || healthQuery.isLoading) {
    return <LoadingState label="Loading admin dashboard" />;
  }

  if (dashboardQuery.isError || healthQuery.isError) {
    return (
      <ErrorState
        title="Unable to load admin dashboard"
        description="We could not fetch platform metrics and health."
        onRetry={() => {
          dashboardQuery.refetch();
          healthQuery.refetch();
        }}
      />
    );
  }

  const dashboard = dashboardQuery.data ?? {};
  const health = healthQuery.data ?? {};
  const alerts = dashboard.alerts ?? [];

  return (
    <div className="admin-dashboard flex flex-col gap-3 text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400">
            Platform overview
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Platform overview, system health and key metrics
            {dashboard.lastUpdatedAt ? ` · Updated ${formatRelativeTime(dashboard.lastUpdatedAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-range" className="sr-only">Analytics time range</label>
          <select
            id="dashboard-range"
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value)}
            className="h-8 rounded-md border border-sky-950 bg-[#071a31] px-2.5 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <IconButton
            label="Refresh dashboard"
            onClick={handleRefresh}
            disabled={dashboardQuery.isFetching || healthQuery.isFetching}
            className="h-8 w-8 border border-sky-950 bg-[#071a31] text-slate-300 hover:bg-blue-950"
          >
            <RefreshCw className={dashboardQuery.isFetching || healthQuery.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          </IconButton>
        </div>
      </div>

      {dashboard.dataFreshnessWarning ? (
        <div className="rounded-md border border-amber-900/70 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          {dashboard.dataFreshnessWarning}
        </div>
      ) : null}

      <MetricGrid dashboard={dashboard} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(245px,0.95fr)_minmax(240px,0.9fr)]">
        <GrowthPanel data={dashboard.platformGrowth ?? []} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <SubscriptionPanel subscriptions={dashboard.subscriptions} />
          <SubscriptionActivityPanel activity={dashboard.subscriptionActivity} />
          <RecentSignups signups={dashboard.recentSignups ?? []} />
          <TopTraders traders={dashboard.topPerformingTraders ?? []} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <AlertPanel alerts={alerts} />
          <PlatformStatus health={health} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.05fr_1fr_1.2fr]">
        <ExchangeOverview exchanges={dashboard.exchangeOverview ?? []} />
        <RecentActivity activities={dashboard.recentActivity ?? []} />
        <QuickActions />
      </div>

      <RecentSignals signals={dashboard.recentSignals ?? []} />

      <div className="flex items-center justify-between border-t border-sky-950 pt-2 text-[10px] text-slate-500">
        <span>SyncExc Platform Operations</span>
        <span>{new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </div>
    </div>
  );
}

function MetricGrid({ dashboard }) {
  const exchangeHealth = dashboard.exchangeHealth ?? {};
  const activeExchanges = Number(dashboard.activeExchanges) ||
    Object.entries(exchangeHealth).reduce((total, [state, count]) =>
      total + (['active', 'healthy', 'connected'].includes(state) ? Number(count) || 0 : 0), 0);
  const metrics = [
    {
      label: 'Total users',
      value: formatNumber(dashboard.totalUsers),
      detail: `${formatNumber(dashboard.users?.newInRange)} new in selected period`,
      icon: Users,
      color: 'blue',
    },
    {
      label: 'Active workspaces',
      value: formatNumber(dashboard.activeWorkspaces),
      detail: `${formatNumber(dashboard.subscriptions?.active)} active subscriptions`,
      icon: Building2,
      color: 'cyan',
    },
    {
      label: 'Connected exchanges',
      value: formatNumber(activeExchanges),
      detail: 'Operational connections',
      icon: Activity,
      color: 'teal',
    },
    {
      label: 'Trading volume (24h)',
      value: formatCurrency(dashboard.tradingVolume24h?.volume),
      detail: dashboard.tradingVolume24h?.changePct == null
        ? 'Executed USD-stablecoin volume · all workspaces'
        : `${dashboard.tradingVolume24h.changePct >= 0 ? '+' : ''}${dashboard.tradingVolume24h.changePct.toFixed(1)}% vs previous 24h`,
      icon: CircleDollarSign,
      color: 'purple',
    },
  ];

  return (
    <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform metrics">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article key={metric.label} className={`${panelClass} relative overflow-hidden p-3`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400">{metric.label}</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-white">
                  {metric.value}
                </p>
                <p className="mt-1 truncate text-[10px] text-slate-500">{metric.detail}</p>
              </div>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${metricColor(metric.color)}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <Sparkline values={metricSparkValues(metric, dashboard)} color={metric.color} />
          </article>
        );
      })}
    </section>
  );
}

function metricSparkValues(metric, dashboard) {
  if (metric.label === 'Connected exchanges') return [];
  if (metric.label === 'Trading volume (24h)') return [];
  const key = metric.label === 'Total users'
    ? 'newUsers'
    : metric.label === 'Active workspaces'
      ? 'newWorkspaces'
      : 'successfulPayments';
  return (dashboard.platformGrowth ?? []).map((item) => Number(item[key]) || 0);
}

function Sparkline({ values, color }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = 25 - (value / max) * 21;
    return `${x},${y}`;
  }).join(' ');
  const stroke = color === 'purple' ? '#a855f7' : color === 'teal' ? '#00c99a' : color === 'cyan' ? '#22d3ee' : '#1685ff';
  return (
    <svg aria-hidden="true" viewBox="0 0 100 28" preserveAspectRatio="none" className="absolute bottom-2 right-3 h-6 w-[27%] opacity-80">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function GrowthPanel({ data }) {
  const rows = data.map((row) => ({
    ...row,
    dateLabel: formatDate(row.date, 'MMM d'),
    newUsers: Number(row.newUsers) || 0,
    newWorkspaces: Number(row.newWorkspaces) || 0,
    successfulPayments: Number(row.successfulPayments) || 0,
  }));
  return (
    <section className={`${panelClass} min-w-0 p-3`}>
      <PanelHeading title="Platform growth" subtitle="New users, workspaces and successful payments" />
      <div className="mt-3 h-52">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1685ff" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#1685ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#12304d" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fill: '#8295ad', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#8295ad', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#071a31', border: '1px solid #153858', borderRadius: 8, color: '#e2e8f0', fontSize: 11 }} />
              <Area type="monotone" dataKey="newUsers" name="New users" stroke="#1685ff" fill="url(#usersFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="newWorkspaces" name="New workspaces" stroke="#00c99a" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="successfulPayments" name="Successful payments" stroke="#a855f7" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <InlineEmpty text="No growth activity in this period." />}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
        <LegendDot color="#1685ff" label="Users" />
        <LegendDot color="#00c99a" label="Workspaces" />
        <LegendDot color="#a855f7" label="Successful payments" />
      </div>
    </section>
  );
}

function SubscriptionPanel({ subscriptions }) {
  const rows = Object.entries(subscriptions?.byStatus ?? {})
    .map(([name, value]) => ({ name: humanize(name), value: Number(value) || 0 }))
    .filter((item) => item.value > 0);
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Subscription status" subtitle="Current platform distribution" />
      {total > 0 ? (
        <div className="mt-2 flex items-center gap-3">
          <div className="relative h-24 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="value" nameKey="name" innerRadius={30} outerRadius={44} paddingAngle={3} stroke="none">
                  {rows.map((row, index) => <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-semibold text-white">{formatNumber(total)}</span>
              <span className="text-[8px] text-slate-500">Subscriptions</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {rows.slice(0, 5).map((row, index) => (
              <li key={row.name} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="flex min-w-0 items-center gap-1.5 text-slate-400">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="text-slate-200">{formatNumber(row.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <InlineEmpty text="No subscription records yet." />}
    </section>
  );
}

function SubscriptionActivityPanel({ activity }) {
  const payouts = activity?.payouts ?? [];
  const subscribers = activity?.subscribedToday ?? [];
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading
        title="Subscription payouts"
        subtitle="Successful payments collected · totals by currency"
        href={ROUTES.console.payments.overview}
      />
      {payouts.length ? (
        <ul className="mt-2 space-y-2">
          {payouts.map((payout) => (
            <li key={payout.currency} className="flex items-center justify-between gap-2 rounded-md bg-[#07152a] px-2.5 py-2">
              <div>
                <p className="text-[10px] font-medium text-slate-200">
                  {formatMinorCurrency(payout.totalPaidMinor, payout.currency)}
                  <span className="ml-1.5 text-[9px] font-normal text-slate-500">all time</span>
                </p>
                <p className="text-[9px] text-slate-500">
                  {formatMinorCurrency(payout.paidTodayMinor, payout.currency)} today UTC
                </p>
              </div>
              <span className="text-right text-[9px] text-slate-400">
                {formatNumber(payout.successfulCount)} payments
              </span>
            </li>
          ))}
        </ul>
      ) : <InlineEmpty text="No successful subscription payouts yet." />}
      <div className="mt-3 border-t border-sky-950 pt-2">
        <PanelHeading
          title={`Subscribed today (UTC) · ${formatNumber(activity?.subscribedTodayCount ?? 0)}`}
          href={ROUTES.console.subscriptions.overview}
        />
        {subscribers.length ? (
          <ul className="mt-1 divide-y divide-sky-950">
            {subscribers.slice(0, 5).map((subscriber) => (
              <li key={subscriber.id} className="flex items-center gap-2 py-1.5">
                <Avatar
                  size="xs"
                  src={subscriber.avatarUrl}
                  alt=""
                  fallback={(subscriber.subscriberName || '?').slice(0, 1).toUpperCase()}
                  className="h-6 w-6 bg-blue-950 text-[9px] text-blue-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-medium text-slate-200">{subscriber.subscriberName || 'Workspace subscriber'}</p>
                  <p className="truncate text-[9px] text-slate-500">{subscriber.planName} · {humanize(subscriber.status)}</p>
                </div>
                <span className="shrink-0 text-[9px] text-slate-500">{formatRelativeTime(subscriber.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="py-3 text-center text-[10px] text-slate-500">No new active subscriptions today (UTC).</p>}
      </div>
    </section>
  );
}

function RecentSignups({ signups }) {
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Recent signups" href={ROUTES.console.users.overview} />
      {signups.length ? (
        <ul className="mt-2 divide-y divide-sky-950">
          {signups.slice(0, 5).map((user) => (
            <li key={user.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
              <Avatar
                size="xs"
                src={user.avatarUrl}
                alt=""
                fallback={(user.displayName || user.username || '?').slice(0, 1).toUpperCase()}
                className="h-7 w-7 bg-blue-950 text-[10px] text-blue-200"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-medium text-slate-200">{user.displayName || user.username}</p>
                <p className="text-[9px] text-slate-500">{formatRelativeTime(user.createdAt)}</p>
              </div>
              <span className={`rounded px-1.5 py-0.5 text-[8px] ${user.status === 'active' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                {humanize(user.status)}
              </span>
            </li>
          ))}
        </ul>
      ) : <InlineEmpty text="No users have signed up yet." />}
    </section>
  );
}

function AlertPanel({ alerts }) {
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="System alerts" href={ROUTES.console.alerts.events} />
      {alerts.length ? (
        <ul className="mt-2 space-y-2">
          {alerts.slice(0, 4).map((alert) => (
            <li key={alert.id} className="flex gap-2">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${alert.severity === 'critical' || alert.severity === 'high' ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'}`}>
                <Bell className="h-3 w-3" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium text-slate-200">{alert.title}</p>
                <p className="truncate text-[9px] text-slate-500">{alert.description || humanize(alert.severity)} · {formatRelativeTime(alert.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-950/40 p-2 text-[10px] text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> No active system alerts
        </div>
      )}
    </section>
  );
}

function PlatformStatus({ health }) {
  const services = health.services ?? [];
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Platform status" href={ROUTES.console.alerts.events} />
      <div className="mt-2 flex items-center justify-between rounded-md bg-[#07152a] px-2.5 py-2">
        <span className="text-[10px] text-slate-400">Overall status</span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {humanize(health.overallStatus || 'unknown')}
        </span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {services.slice(0, 5).map((service) => (
          <li key={service.id ?? service.name} className="flex items-center justify-between gap-2 py-1 text-[10px]">
            <span className="truncate text-slate-400">{service.name}</span>
            <span className={`flex shrink-0 items-center gap-1 ${service.status === 'healthy' ? 'text-emerald-300' : 'text-amber-300'}`}>
              <span className={`h-1 w-1 rounded-full ${service.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {humanize(service.status)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExchangeOverview({ exchanges }) {
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Exchange overview" href={ROUTES.console.exchanges.overview} />
      {exchanges.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-[9px]">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Exchange</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Balance*</th>
                <th className="pb-2 text-right font-medium">24h</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-950">
              {exchanges.slice(0, 6).map((exchange) => {
                const healthy = exchange.connectionCount > 0 &&
                  exchange.healthyCount === exchange.connectionCount;
                return (
                  <tr key={exchange.exchangeCode}>
                    <td className="py-2 font-medium text-slate-200">{exchange.displayName}</td>
                    <td className="py-2">
                      <span className={healthy ? 'text-emerald-300' : 'text-amber-300'}>
                        {healthy ? 'Connected' : `${exchange.healthyCount}/${exchange.connectionCount} healthy`}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-300">
                      {exchange.stablecoinBalanceUsd == null ? '—' : formatCurrency(exchange.stablecoinBalanceUsd)}
                    </td>
                    <td className={`py-2 text-right ${exchange.stablecoinBalanceChangePct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {exchange.stablecoinBalanceChangePct == null
                        ? '—'
                        : `${exchange.stablecoinBalanceChangePct >= 0 ? '+' : ''}${exchange.stablecoinBalanceChangePct.toFixed(2)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[8px] text-slate-600">*USD estimate from available stablecoin balance snapshots.</p>
        </div>
      ) : (
        <InlineEmpty text="No exchange connections are available." />
      )}
    </section>
  );
}

function RecentActivity({ activities }) {
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Recent activity" subtitle="Latest platform events" href={ROUTES.console.audit.overview} />
      {activities.length ? <ul className="mt-2 divide-y divide-sky-950">
        {activities.slice(0, 5).map((event) => {
          return (
            <li key={`${event.resourceType}-${event.id}`} className="flex items-center gap-2 py-2">
              <span className="w-10 shrink-0 text-[9px] text-slate-500">{formatDate(event.occurredAt, 'HH:mm')}</span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-950 text-blue-300">
                <Activity className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] text-slate-200">{event.action}</p>
                <p className="truncate text-[9px] text-slate-500">{event.actorName || 'System'}{event.detail ? ` · ${event.detail}` : ''}</p>
              </div>
            </li>
          );
        })}
      </ul> : <InlineEmpty text="No recent activity recorded." />}
    </section>
  );
}

function TopTraders({ traders }) {
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Top performing traders" href={ROUTES.console.exchanges.overview} />
      {traders.length ? (
        <ul className="mt-2 divide-y divide-sky-950">
          {traders.slice(0, 5).map((trader) => (
            <li key={trader.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
              <Avatar
                size="xs"
                src={trader.avatarUrl}
                alt=""
                fallback={(trader.displayName || trader.handle || '?').slice(0, 1).toUpperCase()}
                className="h-6 w-6 bg-blue-950 text-[9px] text-blue-200"
              />
              <span className="min-w-0 flex-1 truncate text-[10px] text-slate-200">{trader.displayName}</span>
              <span className="w-12 text-right text-[9px] text-slate-300">
                {trader.winRate == null ? '—' : `${trader.winRate.toFixed(1)}%`}
              </span>
              <span className="w-12 text-right text-[9px] text-slate-400">{formatNumber(trader.followers)}</span>
            </li>
          ))}
        </ul>
      ) : <InlineEmpty text="No published trader performance data yet." />}
      <div className="mt-1 flex justify-end gap-3 text-[8px] text-slate-600">
        <span>Win rate*</span><span>Followers</span>
      </div>
      <p className="mt-1 text-[8px] text-slate-600">*Calculated only from explicitly recorded win/loss outcomes.</p>
    </section>
  );
}

function RecentSignals({ signals }) {
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Recent signals" subtitle="Latest published marketplace signals" href={ROUTES.console.signalSources.overview} />
      {signals.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[9px]">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Pair</th>
                <th className="pb-2 font-medium">Direction</th>
                <th className="pb-2 text-right font-medium">Entry</th>
                <th className="pb-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-950">
              {signals.slice(0, 5).map((signal) => (
                <tr key={signal.id}>
                  <td className="py-2 text-slate-500">{formatDate(signal.createdAt, 'HH:mm')}</td>
                  <td className="max-w-36 truncate py-2 text-slate-300">{signal.sourceName}</td>
                  <td className="py-2 font-medium text-slate-200">{signal.instrument}</td>
                  <td className={`py-2 font-medium ${signal.direction === 'long' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {humanize(signal.direction)}
                  </td>
                  <td className="py-2 text-right text-slate-300">{signal.entry == null ? '—' : Number(signal.entry).toLocaleString()}</td>
                  <td className="py-2 text-right text-emerald-300">{humanize(signal.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <InlineEmpty text="No published signals yet." />}
    </section>
  );
}

function QuickActions() {
  const actions = [
    { label: 'Manage users', description: 'Review and control user accounts', href: ROUTES.console.users.overview, icon: Users },
    { label: 'Review alerts', description: 'View platform events', href: ROUTES.console.alerts.events, icon: Bell },
    { label: 'Exchange settings', description: 'Manage exchange integrations', href: ROUTES.console.exchanges.overview, icon: Building2 },
    { label: 'System audit', description: 'Inspect admin activity', href: ROUTES.console.audit.overview, icon: ShieldCheck },
  ];
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Quick actions" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} to={action.href} className="group rounded-md border border-sky-950 bg-[#07152a] p-2 transition hover:border-blue-800 hover:bg-blue-950/40">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-950 text-blue-300">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <p className="mt-1.5 text-[10px] font-medium text-slate-200">{action.label}</p>
              <p className="mt-0.5 line-clamp-1 text-[9px] text-slate-500">{action.description}</p>
              <ArrowRight className="mt-1 h-3 w-3 text-blue-400 opacity-0 transition group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function PanelHeading({ title, subtitle, href }) {
  return (
    <div className="flex min-h-7 items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="truncate text-xs font-semibold text-slate-100">{title}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-[9px] text-slate-500">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link to={href} className="flex shrink-0 items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>;
}

function InlineEmpty({ text }) {
  return <p className="py-6 text-center text-[10px] text-slate-500">{text}</p>;
}

function metricColor(color) {
  return {
    blue: 'bg-blue-950 text-blue-300',
    cyan: 'bg-cyan-950 text-cyan-300',
    teal: 'bg-emerald-950 text-emerald-300',
    purple: 'bg-purple-950 text-purple-300',
  }[color];
}

function formatNumber(value) {
  return value != null && Number.isFinite(Number(value))
    ? Number(value).toLocaleString()
    : '—';
}

function formatCurrency(value) {
  const amount = Number(value);
  return value != null && Number.isFinite(amount)
    ? new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
    : '—';
}

function formatMinorCurrency(value, currency) {
  const amountMinor = Number(value);
  if (!Number.isFinite(amountMinor)) return '—';
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(amountMinor / (10 ** fractionDigits));
  } catch {
    return `${currency} ${(amountMinor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

function humanize(value) {
  return String(value ?? '').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
  Clock3,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
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

import { Button } from '../../components/ui/Button.jsx';
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
          <RecentSignups signups={dashboard.recentSignups ?? []} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <AlertPanel alerts={alerts} />
          <PlatformStatus health={health} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.05fr_1fr_1.2fr]">
        <ExchangeOverview exchangeHealth={dashboard.exchangeHealth ?? {}} />
        <RecentActivity dashboard={dashboard} />
        <QuickActions />
      </div>

      <div className="flex items-center justify-between border-t border-sky-950 pt-2 text-[10px] text-slate-500">
        <span>SyncExc Platform Operations</span>
        <span>{new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </div>
    </div>
  );
}

function MetricGrid({ dashboard }) {
  const payments = dashboard.payments ?? {};
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
      label: 'Successful payments',
      value: formatNumber(payments.successful),
      detail: `${formatNumber(payments.failed)} failed in selected period`,
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

function ExchangeOverview({ exchangeHealth }) {
  const entries = Object.entries(exchangeHealth);
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Exchange overview" href={ROUTES.console.exchanges.overview} />
      {entries.length ? (
        <ul className="mt-2 divide-y divide-sky-950">
          {entries.map(([state, count]) => (
            <li key={state} className="flex items-center justify-between py-2 text-[10px]">
              <span className="flex items-center gap-2 text-slate-300">
                <span className={`h-1.5 w-1.5 rounded-full ${['active', 'healthy', 'connected'].includes(state) ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {humanize(state)}
              </span>
              <span className="font-medium text-slate-100">{formatNumber(count)}</span>
            </li>
          ))}
        </ul>
      ) : <InlineEmpty text="No exchange health data reported." />}
    </section>
  );
}

function RecentActivity({ dashboard }) {
  const events = [
    { label: 'New users', value: dashboard.users?.newInRange, icon: Users, color: 'text-blue-300' },
    { label: 'Payments succeeded', value: dashboard.payments?.successful, icon: CreditCard, color: 'text-emerald-300' },
    { label: 'Payments failed', value: dashboard.payments?.failed, icon: CircleDollarSign, color: 'text-rose-300' },
    { label: 'Open support cases', value: dashboard.support?.open, icon: Clock3, color: 'text-amber-300' },
    { label: 'Queued sync operations', value: dashboard.sync?.queued, icon: Activity, color: 'text-cyan-300' },
  ];
  return (
    <section className={`${panelClass} p-3`}>
      <PanelHeading title="Operations snapshot" subtitle="Current operational counts and selected-period activity" />
      <ul className="mt-2 divide-y divide-sky-950">
        {events.map((event) => {
          const Icon = event.icon;
          return (
            <li key={event.label} className="flex items-center gap-2 py-2">
              <Icon className={`h-3.5 w-3.5 ${event.color}`} />
              <span className="flex-1 text-[10px] text-slate-300">{event.label}</span>
              <span className="text-[10px] font-semibold text-white">{formatNumber(event.value)}</span>
            </li>
          );
        })}
      </ul>
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
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '—';
}

function humanize(value) {
  return String(value ?? '').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

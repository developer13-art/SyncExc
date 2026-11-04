import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDate } from '../../lib/formatters/date.formatter.js';

const COLORS = ['#1685ff', '#00c99a', '#a855f7', '#f59e0b', '#ef4444'];

export function ConsoleTrendChart({ points = [], series = [], height = 220 }) {
  const rows = points.map((point) => ({
    ...point,
    label: point.day ? formatDate(point.day, 'MMM d') : point.label,
  }));
  const activeSeries = series.length > 0 ? series : [{ key: 'count', label: 'Count' }];

  if (rows.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-xs text-muted-foreground">
        No activity recorded in this period.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            {activeSeries.map((entry, index) => (
              <linearGradient key={entry.key} id={`console-fill-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              color: 'hsl(var(--popover-foreground))',
              fontSize: 11,
            }}
          />
          {activeSeries.map((entry, index) => (
            <Area
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={COLORS[index % COLORS.length]}
              fill={`url(#console-fill-${entry.key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ConsoleTrendChart;

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDate } from '../../../lib/formatters/date.formatter.js';

export function PerformanceChart({ points = [], height = 240 }) {
  const rows = points.map((point) => ({
    ...point,
    label: formatDate(point.timestamp, 'MMM d'),
  }));

  if (rows.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border bg-muted/10 text-xs text-muted-foreground">
        No exchange-reconciled results recorded in this period.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="official-pnl-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00c99a" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00c99a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              color: 'hsl(var(--popover-foreground))',
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Cumulative PnL"
            stroke="#00c99a"
            fill="url(#official-pnl-fill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PerformanceChart;

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer } from './ChartContainer.jsx';
import { ChartTooltip } from './ChartTooltip.jsx';
import { formatPercent } from '../../lib/formatters/percent.formatter.js';

export function DrawdownChart({
  title = 'Drawdown',
  subtitle,
  actions,
  data = [],
  xKey = 'timestamp',
  yKey = 'drawdown',
  height = 260,
  isLoading,
  error,
  onRetry,
  className,
}) {
  const isEmpty = !data || data.length === 0;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      actions={actions}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
      height={height}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="drawdown-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatPercent(v, { decimals: 1, already100: true })}
            domain={['auto', 0]}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={(v) => formatPercent(v, { decimals: 2, already100: true })} />
            }
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            fill="url(#drawdown-gradient)"
            isAnimationActive={false}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
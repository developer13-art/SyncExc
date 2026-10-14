import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer } from './ChartContainer.jsx';
import { ChartTooltip } from './ChartTooltip.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

export function EquityCurveChart({
  title = 'Equity Curve',
  subtitle,
  actions,
  data = [],
  xKey = 'timestamp',
  yKey = 'equity',
  currency = 'USD',
  startingValue,
  height = 360,
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
            <linearGradient id="equity-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
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
            tickFormatter={(v) => formatCurrency(v, currency, { compact: true })}
            domain={['auto', 'auto']}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={(v) => formatCurrency(v, currency)} />
            }
          />
          {startingValue !== undefined ? (
            <ReferenceLine
              y={startingValue}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{
                value: 'Start',
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'hsl(var(--muted-foreground))',
              }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey={yKey}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#equity-gradient)"
            isAnimationActive={false}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
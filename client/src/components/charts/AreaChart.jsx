import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer } from './ChartContainer.jsx';
import { ChartTooltip } from './ChartTooltip.jsx';
import { CHART_COLORS } from '../../lib/constants/ui.constants.js';

export function AreaChart({
  title,
  subtitle,
  actions,
  data = [],
  dataKeys = [],
  xKey = 'x',
  height = 320,
  isLoading,
  error,
  onRetry,
  valueFormatter,
  showGrid = true,
  showLegend = true,
  stacked = false,
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
            {dataKeys.map((key, i) => {
              const color = key.color ?? CHART_COLORS[i % CHART_COLORS.length];
              return (
                <linearGradient
                  key={key.key}
                  id={`area-gradient-${key.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          {showGrid ? (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          ) : null}
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
          />
          <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          {showLegend && dataKeys.length > 1 ? (
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          ) : null}
          {dataKeys.map((key, i) => (
            <Area
              key={key.key}
              type="monotone"
              dataKey={key.key}
              name={key.label ?? key.key}
              stroke={key.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              fill={`url(#area-gradient-${key.key})`}
              strokeWidth={2}
              stackId={stacked ? '1' : undefined}
              isAnimationActive={false}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
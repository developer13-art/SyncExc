import {
  LineChart as RechartsLineChart,
  Line,
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

export function LineChart({
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
  className,
  yAxisFormatter,
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
        <RechartsLineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
            tickFormatter={yAxisFormatter}
          />
          <Tooltip
            content={
              <ChartTooltip formatter={valueFormatter} />
            }
          />
          {showLegend && dataKeys.length > 1 ? (
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          ) : null}
          {dataKeys.map((key, i) => (
            <Line
              key={key.key}
              type="monotone"
              dataKey={key.key}
              name={key.label ?? key.key}
              stroke={key.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
import {
  BarChart as RechartsBarChart,
  Bar,
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

export function BarChart({
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
  layout = 'vertical',
  stacked = false,
  showGrid = true,
  showLegend = true,
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
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          {showGrid ? (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          ) : null}
          {layout === 'vertical' ? (
            <>
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
            </>
          ) : (
            <>
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                dataKey={xKey}
                type="category"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={100}
              />
            </>
          )}
          <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          {showLegend && dataKeys.length > 1 ? (
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          ) : null}
          {dataKeys.map((key, i) => (
            <Bar
              key={key.key}
              dataKey={key.key}
              name={key.label ?? key.key}
              fill={key.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              stackId={stacked ? '1' : undefined}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
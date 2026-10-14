import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { ChartContainer } from './ChartContainer.jsx';
import { ChartTooltip } from './ChartTooltip.jsx';
import { CHART_COLORS } from '../../lib/constants/ui.constants.js';

export function PieChart({
  title,
  subtitle,
  actions,
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  height = 320,
  isLoading,
  error,
  onRetry,
  valueFormatter,
  donut = false,
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
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={donut ? '55%' : 0}
            outerRadius="80%"
            paddingAngle={donut ? 2 : 0}
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          {showLegend ? (
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          ) : null}
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
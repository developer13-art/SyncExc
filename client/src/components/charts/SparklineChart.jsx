import {
  AreaChart as RechartsAreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
} from 'recharts';

import { cn } from '../../lib/utils/cn.util.js';

export function SparklineChart({
  data = [],
  dataKey = 'value',
  xKey = 'x',
  color = 'hsl(var(--primary))',
  positiveColor = 'hsl(var(--success))',
  negativeColor = 'hsl(var(--destructive))',
  autoColor = true,
  height = 40,
  className,
}) {
  if (!data || data.length === 0) {
    return null;
  }

  const first = data[0]?.[dataKey] ?? 0;
  const last = data[data.length - 1]?.[dataKey] ?? 0;
  const strokeColor = autoColor
    ? last >= first
      ? positiveColor
      : negativeColor
    : color;

  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
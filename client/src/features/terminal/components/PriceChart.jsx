import { useMemo } from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  BarChart,
  Brush,
  Line,
  ReferenceLine,
} from 'recharts';

import { ChartContainer } from '../../../components/charts/ChartContainer.jsx';
import { formatPrice } from '../../../lib/formatters/currency.formatter.js';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

function CandleShape(props) {
  const { x, y, width, height, low, high, open, close } = props;
  if (x === undefined || y === undefined) {
    return null;
  }

  const isUp = close >= open;
  const fill = isUp ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  const stroke = fill;

  const bodyTop = isUp ? y : y + height;
  const bodyHeight = Math.max(1, Math.abs(height));

  return (
    <g>
      <line x1={x + width / 2} x2={x + width / 2} y1={y - (high - Math.max(open, close))} y2={y + bodyHeight + (Math.min(open, close) - low)} stroke={stroke} strokeWidth={1} />
      <rect x={x} y={bodyTop} width={width} height={bodyHeight} fill={fill} stroke={stroke} />
    </g>
  );
}

function movingAverage(values, index, period) {
  if (index + 1 < period) return null;
  const window = values.slice(index - period + 1, index + 1);
  return window.reduce((sum, value) => sum + value, 0) / period;
}

function calculateRsi(values, index, period = 14) {
  if (index < period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = index - period + 1; i <= index; i += 1) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

export function PriceChart({
  candles = [],
  indicators = ['sma20'],
  levels = [],
  isLoading,
  error,
  onRetry,
  height = 320,
  className,
}) {
  const data = useMemo(
    () => {
      const rows = candles.map((c, i) => ({
        x: i,
        timestamp: c.timestamp,
        open: Number(c.open),
        close: Number(c.close),
        high: Number(c.high),
        low: Number(c.low),
        volume: Number(c.volume ?? 0),
        range: [Number(c.low), Number(c.high)],
      }));
      const closes = rows.map((candle) => candle.close);
      return rows.map((candle, index) => {
        const middle = movingAverage(closes, index, 20);
        const varianceWindow = closes.slice(Math.max(0, index - 19), index + 1);
        const standardDeviation = middle === null
          ? null
          : Math.sqrt(varianceWindow.reduce((sum, close) => sum + ((close - middle) ** 2), 0) / varianceWindow.length);
        return {
          ...candle,
          sma20: middle,
          sma50: movingAverage(closes, index, 50),
          bollingerUpper: standardDeviation === null ? null : middle + 2 * standardDeviation,
          bollingerLower: standardDeviation === null ? null : middle - 2 * standardDeviation,
          rsi14: calculateRsi(closes, index),
        };
      });
    },
    [candles],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ChartContainer
        title={null}
        subtitle={null}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={data.length === 0}
        emptyTitle="No price data"
        emptyDescription="Select an instrument to load market data."
        height={height}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="x" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
            <YAxis
              domain={['dataMin', 'dataMax']}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatPrice(v, { minimumPrecision: 2, maximumPrecision: 6 })}
            />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="mb-1.5 font-medium text-foreground">
                      {d.timestamp ? new Date(d.timestamp).toLocaleString() : '—'}
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span className="text-muted-foreground">O</span>
                      <span className="text-right font-medium text-foreground">{formatQuantity(d.open, 6)}</span>
                      <span className="text-muted-foreground">H</span>
                      <span className="text-right font-medium text-foreground">{formatQuantity(d.high, 6)}</span>
                      <span className="text-muted-foreground">L</span>
                      <span className="text-right font-medium text-foreground">{formatQuantity(d.low, 6)}</span>
                      <span className="text-muted-foreground">C</span>
                      <span className="text-right font-medium text-foreground">{formatQuantity(d.close, 6)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {levels.map((level) => (
              <ReferenceLine
                key={`${level.id ?? level.price}-${level.price}`}
                y={Number(level.price)}
                stroke="hsl(var(--warning))"
                strokeDasharray="5 4"
                label={{ value: level.label || 'Level', fill: 'hsl(var(--warning))', fontSize: 10 }}
              />
            ))}
            <Bar dataKey="range" shape={<CandleShape />} isAnimationActive={false} />
            {indicators.includes('sma20') && (
              <Line type="monotone" dataKey="sma20" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} connectNulls />
            )}
            {indicators.includes('sma50') && (
              <Line type="monotone" dataKey="sma50" stroke="hsl(var(--warning))" strokeWidth={1.5} dot={false} connectNulls />
            )}
            {indicators.includes('bollinger') && (
              <>
                <Line type="monotone" dataKey="bollingerUpper" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} connectNulls />
                <Line type="monotone" dataKey="bollingerLower" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} connectNulls />
              </>
            )}
            <Brush dataKey="x" height={18} stroke="hsl(var(--primary))" travellerWidth={8} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
      {data.length > 0 && (
        <>
          <div className="h-16" role="img" aria-label="Volume by candle">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 2, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="x" hide />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="volume" fill="hsl(var(--muted-foreground))" opacity={0.4} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 px-2 pb-2 text-2xs text-muted-foreground">
            {indicators.includes('sma20') && <span> SMA (20): {formatQuantity(data.at(-1)?.sma20, 6)}</span>}
            {indicators.includes('sma50') && <span>SMA (50): {formatQuantity(data.at(-1)?.sma50, 6)}</span>}
            {indicators.includes('bollinger') && (
              <span>
                Bollinger (20, 2): {formatQuantity(data.at(-1)?.bollingerLower, 6)} – {formatQuantity(data.at(-1)?.bollingerUpper, 6)}
              </span>
            )}
            <span>RSI (14): {formatQuantity(data.at(-1)?.rsi14, 2)}</span>
          </div>
        </>
      )}
    </div>
  );
}
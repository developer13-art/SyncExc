import { useMemo } from 'react';
import {
  CandlestickChart as RechartsCandlestickChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
} from 'recharts';

import { ChartContainer } from '../../../components/charts/ChartContainer.jsx';
import { formatPrice, formatQuantity } from '../../../lib/formatters/currency.formatter.js';

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

export function PriceChart({ candles = [], isLoading, error, onRetry, height = 320, className }) {
  const data = useMemo(
    () =>
      candles.map((c, i) => ({
        x: i,
        timestamp: c.timestamp,
        open: Number(c.open),
        close: Number(c.close),
        high: Number(c.high),
        low: Number(c.low),
        volume: Number(c.volume ?? 0),
        range: [Number(c.low), Number(c.high)],
      })),
    [candles],
  );

  return (
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
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsCandlestickChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }
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
          <Bar dataKey="range" shape={<CandleShape />} isAnimationActive={false} />
        </RechartsCandlestickChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
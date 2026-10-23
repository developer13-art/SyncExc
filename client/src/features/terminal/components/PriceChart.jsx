import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Crosshair,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  MoveUpRight,
  RectangleHorizontal,
  RotateCcw,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  BarChart,
  Line,
  ReferenceLine,
} from 'recharts';

import { ChartContainer } from '../../../components/charts/ChartContainer.jsx';
import { formatPrice } from '../../../lib/formatters/currency.formatter.js';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

function CandleShape(props) {
  const { x, y, width, height, payload } = props;
  const { low, high, open, close } = payload ?? props;
  if (x === undefined || y === undefined) {
    return null;
  }

  const isUp = close >= open;
  const fill = isUp ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  const candleRange = Math.max(high - low, Number.EPSILON);
  const pixelsPerPrice = Math.abs(height) / candleRange;
  const openY = y + (high - open) * pixelsPerPrice;
  const closeY = y + (high - close) * pixelsPerPrice;
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(1, Math.abs(closeY - openY));

  return (
    <g>
      <line x1={x + width / 2} x2={x + width / 2} y1={y} y2={y + height} stroke={fill} strokeWidth={1} />
      <rect x={x} y={bodyTop} width={width} height={bodyHeight} fill={fill} stroke={fill} />
    </g>
  );
}

const DRAWING_TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select and pan' },
  { id: 'crosshair', icon: Crosshair, label: 'Crosshair' },
  { id: 'trendline', icon: MoveUpRight, label: 'Trend line' },
  { id: 'horizontal', icon: Minus, label: 'Horizontal line' },
  { id: 'rectangle', icon: RectangleHorizontal, label: 'Rectangle' },
  { id: 'text', icon: Type, label: 'Text marker' },
];

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
  currentPrice,
  timeframe = '1h',
  height = 320,
  className,
}) {
  const [range, setRange] = useState(null);
  const [chartType, setChartType] = useState('candles');
  const [activeTool, setActiveTool] = useState('select');
  const [drawings, setDrawings] = useState([]);
  const [draftDrawing, setDraftDrawing] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const chartRef = useRef(null);
  const dragRef = useRef(null);
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
      const livePrice = Number(currentPrice);
      if (rows.length && Number.isFinite(livePrice) && livePrice > 0) {
        const last = rows.length - 1;
        rows[last] = {
          ...rows[last],
          close: livePrice,
          high: Math.max(rows[last].high, livePrice),
          low: Math.min(rows[last].low, livePrice),
          range: [Math.min(rows[last].low, livePrice), Math.max(rows[last].high, livePrice)],
        };
      }
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
    [candles, currentPrice],
  );
  const endIndex = Math.min(range?.endIndex ?? data.length - 1, data.length - 1);
  const startIndex = Math.min(
    endIndex,
    Math.max(range?.startIndex ?? Math.max(0, endIndex - Math.min(59, data.length - 1)), 0),
  );
  const visibleCount = Math.max(endIndex - startIndex + 1, 1);
  const shiftRange = (direction) => {
    const nextStart = Math.min(
      Math.max(startIndex + direction * Math.max(1, Math.floor(visibleCount / 5)), 0),
      Math.max(data.length - visibleCount, 0),
    );
    setRange({ startIndex: nextStart, endIndex: nextStart + visibleCount - 1 });
  };
  const zoomRange = (direction) => {
    const nextCount = Math.min(
      Math.max(visibleCount + direction * 10, 20),
      data.length,
    );
    const nextEnd = Math.min(Math.max(endIndex, nextCount - 1), data.length - 1);
    setRange({
      startIndex: Math.max(0, nextEnd - nextCount + 1),
      endIndex: nextEnd,
    });
  };
  const handleChartWheel = (event) => {
    if (data.length < 2) return;
    event.preventDefault();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      zoomRange(event.deltaY > 0 ? 1 : -1);
      return;
    }
    shiftRange(event.deltaY > 0 || event.deltaX > 0 ? -1 : 1);
  };
  useEffect(() => {
    const chartElement = chartRef.current;
    if (!chartElement) return undefined;
    chartElement.addEventListener('wheel', handleChartWheel, { passive: false });
    return () => chartElement.removeEventListener('wheel', handleChartWheel);
  });

  useEffect(() => {
    if (!fullscreen) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [fullscreen]);

  const pointerPosition = (event) => {
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (activeTool === 'crosshair') return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointerPosition(event);
    if (!point) return;
    if (activeTool === 'select') {
      dragRef.current = { x: event.clientX, startIndex };
      return;
    }
    if (activeTool === 'horizontal' || activeTool === 'text') {
      setDrawings((current) => [...current, {
        id: `${Date.now()}-${current.length}`,
        type: activeTool,
        start: point,
        end: point,
      }]);
      return;
    }
    dragRef.current = { point, drawing: true };
    setDraftDrawing({ type: activeTool, start: point, end: point });
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.drawing) {
      const point = pointerPosition(event);
      if (point) setDraftDrawing((current) => current ? { ...current, end: point } : current);
      return;
    }
    const delta = drag.x - event.clientX;
    const candleStep = Math.max(1, Math.floor(visibleCount / 90));
    const offset = Math.round(delta / 12) * candleStep;
    if (!offset) return;
    const nextStart = Math.min(
      Math.max(drag.startIndex + offset, 0),
      Math.max(data.length - visibleCount, 0),
    );
    setRange({ startIndex: nextStart, endIndex: nextStart + visibleCount - 1 });
  };

  const handlePointerUp = () => {
    if (dragRef.current?.drawing && draftDrawing) {
      setDrawings((current) => [...current, {
        ...draftDrawing,
        id: `${Date.now()}-${current.length}`,
      }]);
    }
    dragRef.current = null;
    setDraftDrawing(null);
  };

  const downloadChart = () => {
    const svg = chartRef.current?.querySelector('svg.recharts-surface');
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `syncexc-${timeframe}-chart.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const visibleDrawings = draftDrawing
    ? [...drawings, { ...draftDrawing, id: 'draft' }]
    : drawings;
  const chartHeight = fullscreen ? 'calc(100dvh - 140px)' : height;

  return (
    <div className={cn('client-price-chart flex flex-col', fullscreen && 'client-price-chart-fullscreen', className)}>
      {data.length > 0 ? (
        <div className="client-chart-toolbar">
          <div className="client-chart-toolbar-actions">
            <span className="client-chart-live-label">
              {Number.isFinite(Number(currentPrice)) && Number(currentPrice) > 0
                ? formatPrice(Number(currentPrice), { minimumPrecision: 2, maximumPrecision: 8 })
                : `${timeframe} chart`}
            </span>
            <button type="button" className={cn('client-chart-tool', chartType === 'candles' && 'is-active')} aria-label="Candlestick chart" aria-pressed={chartType === 'candles'} title="Candlesticks" onClick={() => setChartType('candles')}>
              <span className="client-candle-icon"><i /></span>
            </button>
            <button type="button" className={cn('client-chart-tool', chartType === 'line' && 'is-active')} aria-label="Line chart" aria-pressed={chartType === 'line'} title="Line chart" onClick={() => setChartType('line')}><MoveUpRight /></button>
            <span className="client-chart-toolbar-divider" />
            <button type="button" className="client-chart-tool" aria-label="Scroll to older candles" title="Older candles" onClick={() => shiftRange(-1)}><Minus /></button>
            <button type="button" className="client-chart-tool" aria-label="Zoom in" title="Zoom in" onClick={() => zoomRange(-1)}><ZoomIn /></button>
            <button type="button" className="client-chart-tool" aria-label="Zoom out" title="Zoom out" onClick={() => zoomRange(1)}><ZoomOut /></button>
            <button type="button" className="client-chart-tool" aria-label="Reset chart view" title="Reset chart view" onClick={() => setRange({ startIndex: Math.max(0, data.length - Math.min(60, data.length)), endIndex: data.length - 1 })}><RotateCcw /></button>
            <button type="button" className="client-chart-tool" aria-label="Download chart" title="Download chart as SVG" onClick={downloadChart}><Camera /></button>
            <button type="button" className="client-chart-tool" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => setFullscreen((current) => !current)}>
              {fullscreen ? <Minimize2 /> : <Maximize2 />}
            </button>
          </div>
        </div>
      ) : null}
      <ChartContainer
        title={null}
        subtitle={null}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={data.length === 0}
        emptyTitle="No price data"
        emptyDescription="Select an instrument to load market data."
        height={chartHeight}
        className="border-0 bg-transparent p-0 shadow-none"
      >
        <div className="client-chart-stage h-full">
          <div className="client-chart-tool-rail" aria-label="Drawing tools">
            {DRAWING_TOOLS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                className={cn('client-chart-tool', activeTool === id && 'is-active')}
                aria-label={label}
                aria-pressed={activeTool === id}
                title={label}
                onClick={() => setActiveTool(id)}
              >
                <Icon />
              </button>
            ))}
            <span className="client-chart-toolbar-divider" />
            <button
              type="button"
              className="client-chart-tool"
              aria-label="Clear drawings"
              title="Clear drawings"
              onClick={() => setDrawings([])}
              disabled={drawings.length === 0}
            >
              <Trash2 />
            </button>
          </div>
          <div
            ref={chartRef}
            className={cn(
              'client-chart-canvas relative h-full min-w-0 flex-1',
              activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
            )}
            aria-label="Interactive price chart. Scroll to pan; Ctrl or Shift plus scroll to zoom."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.slice(startIndex, endIndex + 1)} margin={{ top: 8, right: 72, left: 8, bottom: 18 }}>
            <CartesianGrid strokeDasharray="1 0" stroke="hsl(var(--border))" vertical />
            <XAxis
              dataKey="x"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(index) => {
                const candle = data[index];
                if (!candle?.timestamp) return '';
                const date = new Date(candle.timestamp);
                return ['1d', '1w', '1M'].includes(timeframe)
                  ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
                  : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }}
            />
            <YAxis
              orientation="right"
              domain={['dataMin', 'dataMax']}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
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
            {Number.isFinite(Number(currentPrice)) && Number(currentPrice) > 0 ? (
              <ReferenceLine
                y={Number(currentPrice)}
                stroke="hsl(var(--success))"
                strokeDasharray="4 3"
                label={{ value: 'Live', fill: 'hsl(var(--success))', fontSize: 10, position: 'right' }}
              />
            ) : null}
            {chartType === 'candles' ? (
              <Bar dataKey="range" shape={<CandleShape />} isAnimationActive={false} />
            ) : (
              <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
            )}
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
            </ComposedChart>
          </ResponsiveContainer>
          <svg className="client-chart-drawing-layer" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
            {visibleDrawings.map((drawing) => {
              const x1 = drawing.start.x * 10;
              const y1 = drawing.start.y * 5;
              const x2 = drawing.end.x * 10;
              const y2 = drawing.end.y * 5;
              if (drawing.type === 'horizontal') {
                return <line key={drawing.id} x1="0" x2="1000" y1={y1} y2={y1} className="client-chart-drawing-line" />;
              }
              if (drawing.type === 'rectangle') {
                return <rect
                  key={drawing.id}
                  x={Math.min(x1, x2)}
                  y={Math.min(y1, y2)}
                  width={Math.max(1, Math.abs(x2 - x1))}
                  height={Math.max(1, Math.abs(y2 - y1))}
                  className="client-chart-drawing-rect"
                />;
              }
              if (drawing.type === 'text') {
                return <text key={drawing.id} x={x1} y={y1} className="client-chart-drawing-text">Text</text>;
              }
              return <line key={drawing.id} x1={x1} y1={y1} x2={x2} y2={y2} className="client-chart-drawing-line" />;
            })}
          </svg>
          </div>
        </div>
      </ChartContainer>
      {data.length > 0 && (
        <>
          <div className="client-volume-chart h-16" role="img" aria-label="Volume by candle">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.slice(startIndex, endIndex + 1)} margin={{ top: 2, right: 72, left: 8, bottom: 0 }}>
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
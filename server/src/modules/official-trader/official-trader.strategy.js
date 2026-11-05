/**
 * SyncExc Server — Official AI Trader deterministic strategy and checks
 */

import { compareDecimals } from '@syncexc/shared';

export function computeIndicators(candles) {
  if (!Array.isArray(candles) || candles.length < 60) return null;
  const closes = candles.map((candle) => Number(candle.close));
  const highs = candles.map((candle) => Number(candle.high));
  const lows = candles.map((candle) => Number(candle.low));
  if ([...closes, ...highs, ...lows].some((value) => !Number.isFinite(value) || value <= 0)) {
    return null;
  }
  const average = (values, period) =>
    values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
  const sma20 = average(closes, 20);
  const sma50 = average(closes, 50);
  const sma200 = closes.length >= 200 ? average(closes, 200) : null;
  const price = closes.at(-1);
  const changes = closes.slice(-29).map((value, index, values) =>
    index ? value - values[index - 1] : 0,
  ).slice(1);
  const gains = changes.map((change) => Math.max(change, 0));
  const losses = changes.map((change) => Math.max(-change, 0));
  const averageGain = gains.reduce((sum, value) => sum + value, 0) / Math.max(gains.length, 1);
  const averageLoss = losses.reduce((sum, value) => sum + value, 0) / Math.max(losses.length, 1);
  const rsi = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  const trueRanges = candles.slice(-15).map((candle, index, values) => {
    const previousClose = index === 0 ? Number(values[index].close) : Number(values[index - 1].close);
    return Math.max(
      Number(candle.high) - Number(candle.low),
      Math.abs(Number(candle.high) - previousClose),
      Math.abs(Number(candle.low) - previousClose),
    );
  });
  const atr = trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
  if (!Number.isFinite(atr) || atr <= 0) return null;
  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow = Math.min(...lows.slice(-20));
  const priorHigh = Math.max(...highs.slice(-40, -20));
  const priorLow = Math.min(...lows.slice(-40, -20));
  const change24h = closes.length > 24 ? ((price - closes.at(-25)) / closes.at(-25)) * 100 : 0;
  return {
    price: Number(price.toPrecision(12)),
    sma20: Number(sma20.toPrecision(12)),
    sma50: Number(sma50.toPrecision(12)),
    sma200: sma200 == null ? null : Number(sma200.toPrecision(12)),
    rsi: Number(rsi.toPrecision(6)),
    atr: Number(atr.toPrecision(12)),
    recentHigh: Number(recentHigh.toPrecision(12)),
    recentLow: Number(recentLow.toPrecision(12)),
    priorHigh: Number(priorHigh.toPrecision(12)),
    priorLow: Number(priorLow.toPrecision(12)),
    change24h: Number(change24h.toPrecision(6)),
    candleCount: candles.length,
    lastCandleAt: candles.at(-1)?.timestamp || candles.at(-1)?.time || null,
  };
}

export function evaluateStrategy({ indicators, marketType, allowedStrategies }) {
  if (!indicators) return null;
  const {
    price, sma20, sma50, sma200, rsi, atr, recentHigh, priorHigh, recentLow, priorLow, change24h,
  } = indicators;
  const strategies = new Set(allowedStrategies || ['trend_following', 'breakout', 'momentum']);
  const candidates = [];

  if (
    strategies.has('trend_following') &&
    price > sma20 && sma20 > sma50 &&
    (sma200 == null || sma50 > sma200) &&
    rsi >= 50 && rsi <= 70
  ) {
    candidates.push({
      direction: 'long',
      strategyKey: 'trend_following',
      confidence: clamp(0.62 + Math.abs((sma20 - sma50) / sma50) * 4 + (rsi - 50) / 200, 0.62, 0.92),
      reason: 'Price is above a rising 20/50 moving-average structure with constructive momentum.',
    });
  }
  if (
    marketType === 'futures' &&
    strategies.has('trend_following') &&
    price < sma20 && sma20 < sma50 &&
    (sma200 == null || sma50 < sma200) &&
    rsi >= 30 && rsi < 50
  ) {
    candidates.push({
      direction: 'short',
      strategyKey: 'trend_following',
      confidence: clamp(0.62 + Math.abs((sma50 - sma20) / sma50) * 4 + (50 - rsi) / 200, 0.62, 0.92),
      reason: 'Price is below a falling 20/50 moving-average structure with bearish momentum.',
    });
  }
  if (
    strategies.has('breakout') &&
    price > priorHigh && change24h > 0.5 && rsi >= 55 && rsi <= 76
  ) {
    candidates.push({
      direction: 'long',
      strategyKey: 'breakout',
      confidence: clamp(0.66 + (rsi - 55) / 120, 0.66, 0.9),
      reason: 'Price broke above the prior 20-candle range high with positive momentum.',
    });
  }
  if (
    marketType === 'futures' &&
    strategies.has('breakout') &&
    price < priorLow && change24h < -0.5 && rsi >= 24 && rsi <= 45
  ) {
    candidates.push({
      direction: 'short',
      strategyKey: 'breakout',
      confidence: clamp(0.66 + (45 - rsi) / 120, 0.66, 0.9),
      reason: 'Price broke below the prior 20-candle range low with negative momentum.',
    });
  }
  if (
    strategies.has('momentum') &&
    change24h > 1.2 && rsi >= 60 && rsi <= 78 && price > sma20
  ) {
    candidates.push({
      direction: 'long',
      strategyKey: 'momentum',
      confidence: clamp(0.63 + change24h / 30, 0.63, 0.9),
      reason: 'Recent price momentum and RSI are positive without an overextended reading.',
    });
  }
  if (
    marketType === 'futures' &&
    strategies.has('momentum') &&
    change24h < -1.2 && rsi >= 22 && rsi <= 40 && price < sma20
  ) {
    candidates.push({
      direction: 'short',
      strategyKey: 'momentum',
      confidence: clamp(0.63 + Math.abs(change24h) / 30, 0.63, 0.9),
      reason: 'Recent downside momentum and RSI are negative without an oversold exhaustion reading.',
    });
  }

  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];
  if (!best) return null;
  const stopDistance = atr * 1.5;
  const targetDistance = atr * 3;
  const entry = price;
  const stopLoss = best.direction === 'long' ? entry - stopDistance : entry + stopDistance;
  const targets = best.direction === 'long'
    ? [entry + targetDistance]
    : [entry - targetDistance];
  return {
    direction: best.direction,
    strategyKey: best.strategyKey,
    confidence: Number(best.confidence.toFixed(4)),
    entry: decimal(entry),
    stopLoss: decimal(stopLoss),
    targets: targets.map(decimal),
    riskReward: 2,
    marketCondition: describeCondition(indicators),
    reasoning: best.reason,
    invalidationCondition: best.direction === 'long'
      ? `A close below ${decimal(stopLoss)} invalidates the long setup.`
      : `A close above ${decimal(stopLoss)} invalidates the short setup.`,
    indicators: {
      ...indicators,
      recentHigh,
      recentLow,
      targetDistance,
      stopDistance,
    },
  };
}

export function validateTradeLevels({ direction, entry, stopLoss, targets, minimumRiskReward = 1.5 }) {
  const entryValue = Number(entry);
  const stopValue = Number(stopLoss);
  const targetValues = Array.isArray(targets) ? targets.map(Number) : [];
  if (!Number.isFinite(entryValue) || entryValue <= 0) return 'Entry price must be positive';
  if (!Number.isFinite(stopValue) || stopValue <= 0) return 'Stop-loss price is required and must be positive';
  if (targetValues.length === 0 || targetValues.some((value) => !Number.isFinite(value) || value <= 0)) {
    return 'At least one positive take-profit target is required';
  }
  const risk = direction === 'long' ? entryValue - stopValue : stopValue - entryValue;
  if (risk <= 0) return 'Stop-loss must be on the correct side of the entry for the trade direction';
  for (const target of targetValues) {
    const reward = direction === 'long' ? target - entryValue : entryValue - target;
    if (reward <= 0) return 'Take-profit targets must be on the correct side of the entry';
    if (reward / risk < minimumRiskReward) {
      return `Risk-to-reward must be at least ${minimumRiskReward}`;
    }
  }
  return null;
}

export function roundToStep(value, step, mode = 'floor') {
  const numeric = Number(value);
  const stepValue = Number(step);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (!Number.isFinite(stepValue) || stepValue <= 0) return numeric;
  const units = mode === 'ceil' ? Math.ceil(numeric / stepValue) : Math.floor(numeric / stepValue);
  if (units <= 0) return null;
  const result = units * stepValue;
  return Number(result.toPrecision(15));
}

export function alignToTick(value, tickSize) {
  const numeric = Number(value);
  const tick = Number(tickSize);
  if (!Number.isFinite(numeric) || numeric <= 0 || !Number.isFinite(tick) || tick <= 0) return null;
  return Number((Math.round(numeric / tick) * tick).toPrecision(15));
}

export function isTickAligned(value, tickSize) {
  if (value == null) return true;
  const aligned = alignToTick(value, tickSize);
  return aligned != null && compareDecimals(String(aligned), String(value)) === 0;
}

export function isWithinSchedule(schedule, date = new Date()) {
  if (!schedule || typeof schedule !== 'object') return true;
  const timezone = schedule.timezone || 'UTC';
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
  } catch {
    return false;
  }
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = weekdayMap[part('weekday')];
  const hour = Number(part('hour')) % 24;
  const minute = Number(part('minute'));
  const currentMinutes = hour * 60 + minute;
  const permittedDays = Array.isArray(schedule.days) && schedule.days.length > 0
    ? schedule.days.map(Number)
    : [0, 1, 2, 3, 4, 5, 6];
  if (!permittedDays.includes(day)) return false;
  const start = parseClock(schedule.start || '00:00');
  const end = parseClock(schedule.end || '23:59');
  if (start == null || end == null) return false;
  if (start <= end) return currentMinutes >= start && currentMinutes <= end;
  return currentMinutes >= start || currentMinutes <= end;
}

export function maxDrawdownPercent(points) {
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of points) {
    const value = Number(point.value);
    if (!Number.isFinite(value)) continue;
    if (value > peak) peak = value;
    if (peak > 0) {
      const drawdown = ((peak - value) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function describeCondition(indicators) {
  if (indicators.rsi >= 70) return 'extended_uptrend';
  if (indicators.rsi <= 30) return 'extended_downtrend';
  if (indicators.price > indicators.sma20 && indicators.sma20 > indicators.sma50) return 'uptrend';
  if (indicators.price < indicators.sma20 && indicators.sma20 < indicators.sma50) return 'downtrend';
  return 'range';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function decimal(value) {
  if (!Number.isFinite(value)) return null;
  return String(Number(value.toPrecision(12)));
}

export default {
  computeIndicators,
  evaluateStrategy,
  validateTradeLevels,
  roundToStep,
  alignToTick,
  isTickAligned,
  isWithinSchedule,
  maxDrawdownPercent,
};

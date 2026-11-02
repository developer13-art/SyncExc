const OFFICIAL_HANDLE = 'syncexc-official';
const SCAN_TIMEFRAME = '15m';
const AI_REVIEW_LIMIT = 10;

export function createOfficialTraderService({ db, marketData, ai, publication, logger }) {
  let scanRunning = false;

  async function scanNow() {
    if (scanRunning) return { skipped: true, reason: 'A scan is already running' };
    scanRunning = true;
    try {
      const providerResult = await db.query(
        `SELECT id, user_id, workspace_id FROM marketplace_provider_profiles WHERE handle = $1 AND moderation_state = 'approved' AND visibility = 'public'`,
        [OFFICIAL_HANDLE]
      );
      const provider = providerResult.rows[0];
      if (!provider) throw new Error('SyncExc Official marketplace provider is not provisioned');

      const instrumentResult = await db.query(
        `
        WITH active_instruments AS (
          SELECT exchange_code,
                 exchange_symbol,
                 market_type,
                 regexp_replace(
                   regexp_replace(upper(normalized_symbol), '(SWAP|PERPETUAL|PERP)$', ''),
                   '[^A-Z0-9]',
                   '',
                   'g'
                 ) AS canonical_symbol
          FROM exchange_instruments
          WHERE exchange_code IN ('binance', 'bybit', 'bitget', 'okx')
            AND market_type IN ('spot', 'futures')
            AND trading_status = 'active'
        )
        SELECT exchange_code,
               exchange_symbol,
               canonical_symbol AS normalized_symbol,
               market_type
        FROM active_instruments
        ORDER BY canonical_symbol, market_type,
                 array_position(ARRAY['binance', 'bybit', 'bitget', 'okx'], exchange_code),
                 exchange_symbol
        `
      );
      const instrumentGroups = new Map();
      for (const instrument of instrumentResult.rows) {
        const key = `${instrument.normalized_symbol}:${instrument.market_type}`;
        const group = instrumentGroups.get(key) || [];
        group.push(instrument);
        instrumentGroups.set(key, group);
      }
      const instruments = [...instrumentGroups.values()];
      const candidates = [];
      let dataFailures = 0;
      let nextIndex = 0;
      const workerCount = Math.min(3, instruments.length);

      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < instruments.length) {
          const instrumentGroup = instruments[nextIndex];
          nextIndex += 1;
          let receivedMarketData = false;
          for (const instrument of instrumentGroup) {
            try {
              const result = await marketData.getCandles({
                exchangeCode: instrument.exchange_code,
                symbol: instrument.exchange_symbol,
                marketType: instrument.market_type,
                timeframe: SCAN_TIMEFRAME,
                limit: 80,
              });
              receivedMarketData = true;
              const analysis = analyzeCandles(result.candles, instrument.market_type);
              if (analysis) candidates.push({ ...instrument, ...analysis });
              break;
            } catch (error) {
              logger.warn(
                { err: error, exchangeCode: instrument.exchange_code, symbol: instrument.exchange_symbol },
                'Official trader could not analyze instrument on exchange',
              );
            }
          }
          if (!receivedMarketData) dataFailures += 1;
        }
      }));

      candidates.sort((left, right) => right.score - left.score);
      let published = 0;
      let aiRejected = 0;
      let publicationFailures = 0;

      for (const candidate of candidates.slice(0, AI_REVIEW_LIMIT)) {
        try {
          const activeSignal = await db.query(
            `
            SELECT id FROM marketplace_published_signals
            WHERE provider_id = $1
              AND instrument = $2
              AND market_type = $3
              AND status IN ('published', 'updated')
              AND (valid_until IS NULL OR valid_until > now())
            LIMIT 1
            `,
            [provider.id, candidate.normalized_symbol, candidate.market_type]
          );
          if (activeSignal.rows[0]) continue;

          const review = await reviewWithAi(candidate);
          if (!review.publish || review.confidence < 0.75) {
            aiRejected += 1;
            continue;
          }

          const now = new Date();
          await publication.publishSignal({
            userId: provider.user_id,
            workspaceId: provider.workspace_id,
            providerId: provider.id,
            instrument: candidate.normalized_symbol,
            marketType: candidate.market_type,
            direction: candidate.direction,
            orderType: 'market',
            entryTime: now,
            stopLoss: candidate.stopLoss,
            targets: [candidate.takeProfit],
            leverage: candidate.market_type === 'futures' ? '1' : null,
            validUntil: new Date(now.getTime() + 30 * 60 * 1000),
            sourceEvidence: {
              type: 'official_market_scan',
              timeframe: SCAN_TIMEFRAME,
              exchange: candidate.exchange_code,
              observedPrice: candidate.price,
              indicators: candidate.indicators,
              aiSummary: review.summary,
              methodology: 'market_data_technical_screen_v1',
            },
            disclosures: {
              risk: 'Automated market-data analysis; not financial advice or a guarantee of results.',
            },
          });
          published += 1;
        } catch (error) {
          publicationFailures += 1;
          logger.error(
            { err: error, symbol: candidate.normalized_symbol, marketType: candidate.market_type },
            'Official trader signal publication failed',
          );
        }
      }

      const summary = {
        instrumentsScanned: instrumentGroups.size,
        dataFailures,
        candidates: candidates.length,
        aiReviewed: Math.min(candidates.length, AI_REVIEW_LIMIT),
        aiRejected,
        published,
        publicationFailures,
      };
      logger.info(summary, 'Official trader market scan completed');
      if (instrumentGroups.size === 0 || dataFailures === instrumentGroups.size) {
        throw new Error('Official trader scan could not retrieve market data for any instrument');
      }
      if (candidates.length > 0 && published === 0 && aiRejected === 0 && publicationFailures > 0) {
        throw new Error('Official trader could not review or publish any candidate signal');
      }
      return summary;
    } finally {
      scanRunning = false;
    }
  }

  async function reviewWithAi(candidate) {
    if (!ai?.chatJson) throw new Error('AI review is not configured for the official trader');
    const { data } = await ai.chatJson({
      system: [
        'You are reviewing a rule-generated crypto market signal for publication.',
        'Use only the supplied market data. Do not invent prices, news, or facts.',
        'Return JSON with publish (boolean), confidence (number 0..1), and summary (string).',
        'Publish only when the direction is supported by the moving averages and RSI and the risk levels are coherent.',
        'This review does not authorize or execute trades.',
      ].join(' '),
      messages: [{
        role: 'user',
        content: JSON.stringify({
          symbol: candidate.normalized_symbol,
          marketType: candidate.market_type,
          direction: candidate.direction,
          timeframe: SCAN_TIMEFRAME,
          price: candidate.price,
          stopLoss: candidate.stopLoss,
          takeProfit: candidate.takeProfit,
          indicators: candidate.indicators,
        }),
      }],
      maxTokens: 180,
      temperature: 0,
      rateKey: 'marketplace:official-trader',
    });
    const confidence = Number(data?.confidence);
    if (typeof data?.publish !== 'boolean' || !Number.isFinite(confidence) ||
        typeof data?.summary !== 'string') {
      throw new Error('AI returned an invalid official-trader review');
    }
    return {
      publish: data.publish,
      confidence: Math.max(0, Math.min(1, confidence)),
      summary: data.summary.slice(0, 500),
    };
  }

  return { scanNow };
}

export function analyzeCandles(candles, marketType) {
  if (!Array.isArray(candles) || candles.length < 55) return null;
  const closes = candles.map((candle) => Number(candle.close));
  const highs = candles.map((candle) => Number(candle.high));
  const lows = candles.map((candle) => Number(candle.low));
  if ([...closes, ...highs, ...lows].some((value) => !Number.isFinite(value) || value <= 0)) return null;

  const sma = (values, period) => values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const price = closes.at(-1);
  const changes = closes.slice(-15).map((value, index, values) => index ? value - values[index - 1] : 0).slice(1);
  const gains = changes.map((change) => Math.max(change, 0));
  const losses = changes.map((change) => Math.max(-change, 0));
  const averageGain = gains.reduce((sum, value) => sum + value, 0) / gains.length;
  const averageLoss = losses.reduce((sum, value) => sum + value, 0) / losses.length;
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

  let direction = null;
  if (price > sma20 && sma20 > sma50 && rsi >= 50 && rsi <= 68) direction = 'long';
  if (marketType === 'futures' && price < sma20 && sma20 < sma50 && rsi >= 32 && rsi < 50) {
    direction = 'short';
  }
  if (!direction) return null;

  const stopLoss = direction === 'long' ? price - 1.5 * atr : price + 1.5 * atr;
  const takeProfit = direction === 'long' ? price + 3 * atr : price - 3 * atr;
  return {
    direction,
    price: String(price),
    stopLoss: stopLoss.toPrecision(12),
    takeProfit: takeProfit.toPrecision(12),
    score: Math.abs((price - sma50) / sma50) + Math.abs(rsi - 50) / 100,
    indicators: {
      sma20: Number(sma20.toPrecision(10)),
      sma50: Number(sma50.toPrecision(10)),
      rsi: Number(rsi.toPrecision(6)),
      atr: Number(atr.toPrecision(10)),
    },
  };
}

export default createOfficialTraderService;

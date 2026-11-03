const OFFICIAL_HANDLE = 'syncexc-official';
const AI_RESEARCH_LIMIT = 5;
const AI_RESEARCH_UNIVERSE_LIMIT = 20;
const AI_RESEARCH_ROTATION_MS = 15 * 60 * 1000;
const MIN_CONFIDENCE = 0.8;

export function createOfficialTraderService({ db, ai, publication, logger }) {
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
        SELECT DISTINCT
               regexp_replace(
                 regexp_replace(upper(normalized_symbol), '(SWAP|PERPETUAL|PERP)$', ''),
                 '[^A-Z0-9]',
                 '',
                 'g'
               ) AS symbol,
               market_type AS "marketType"
        FROM exchange_instruments
        WHERE exchange_code IN ('binance', 'bybit', 'bitget', 'okx')
          AND market_type IN ('spot', 'futures')
          AND trading_status = 'active'
        ORDER BY symbol, "marketType"
        `
      );
      const universe = instrumentResult.rows
        .map(({ symbol, marketType }) => ({
          symbol: String(symbol || '').toUpperCase(),
          marketType,
        }))
        .filter(({ symbol, marketType }) =>
          /^[A-Z0-9]{3,48}$/.test(symbol) && ['spot', 'futures'].includes(marketType)
        );
      if (universe.length === 0) throw new Error('Official trader has no active catalog instruments to research');

      const researchUniverse = selectResearchUniverse(universe, Date.now());
      let candidates;
      try {
        candidates = await researchWithAi(researchUniverse);
      } catch (error) {
        if (error?.code !== 'AI_RATE_LIMITED') throw error;
        logger.warn(
          {
            err: error,
            instrumentsAvailable: universe.length,
            instrumentsResearched: researchUniverse.length,
          },
          'Official trader research deferred by AI provider rate limit',
        );
        return {
          skipped: true,
          reason: 'AI provider rate limit',
          instrumentsAvailable: universe.length,
          instrumentsResearched: researchUniverse.length,
        };
      }

      let published = 0;
      let aiRejected = 0;
      let publicationFailures = 0;

      for (const candidate of candidates) {
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

          if (candidate.confidence < MIN_CONFIDENCE) {
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
            orderType: 'limit',
            entryTime: now,
            entry: candidate.entry,
            stopLoss: candidate.stopLoss,
            targets: candidate.targets,
            leverage: candidate.market_type === 'futures' ? '1' : null,
            validUntil: new Date(now.getTime() + 30 * 60 * 1000),
            sourceEvidence: {
              type: 'official_ai_research',
              analysis: candidate.analysis,
              confidence: candidate.confidence,
              sources: candidate.sources,
              researchedAt: now.toISOString(),
              methodology: 'groq_browser_search_research_v1',
            },
            disclosures: {
              risk: 'AI-generated research based on cited web sources; prices and conditions may change. Not financial advice or a guarantee of results.',
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
        instrumentsScanned: universe.length,
        instrumentsResearched: researchUniverse.length,
        candidates: candidates.length,
        aiResearched: Math.min(candidates.length, AI_RESEARCH_LIMIT),
        aiRejected,
        published,
        publicationFailures,
      };
      logger.info(summary, 'Official trader AI research scan completed');
      if (candidates.length > 0 && published === 0 && aiRejected === 0 && publicationFailures > 0) {
        throw new Error('Official trader could not publish any AI-researched candidate signal');
      }
      return summary;
    } finally {
      scanRunning = false;
    }
  }

  async function researchWithAi(universe) {
    if (!ai?.chatJson) throw new Error('AI research is not configured for the official trader');
    const { data } = await ai.chatJson({
      system: [
        'You are an independent cryptocurrency market researcher creating actionable, risk-aware marketplace trade ideas.',
        'Use browser search to research the current market, recent developments, and recent price context for symbols in the supplied catalog.',
        'Do not call or assume access to exchange APIs, candles, order books, or private account data.',
        'Only cite facts supported by pages you actually found through browser search; do not invent URLs, prices, catalysts, or facts.',
        'Select at most 5 well-supported opportunities from the supplied symbol and market-type catalog. Return an empty signals array when none is sufficiently supported.',
        'For each opportunity, return symbol, marketType, confidence (0..1), direction (long or short), entry, stopLoss, targets (one to three prices), analysis, and sources (at least two objects with title and https URL).',
        'Use a limit entry price based on recent price information in the sources. Set stop loss and targets on the correct side of the entry, and target at least 1.5 times the risk.',
        'Only propose short trades for futures. Use positive numeric prices and only exact catalog symbols and market types.',
        'Return only valid JSON with this shape: {"signals":[{"symbol":"BTCUSDT","marketType":"spot","confidence":0.9,"direction":"long","entry":"100","stopLoss":"95","targets":["110"],"analysis":"...","sources":[{"title":"...","url":"https://..."}]}]}.',
        'These are research ideas for subscribers to review and optionally copy; they do not authorize or execute trades.',
      ].join(' '),
      messages: [{
        role: 'user',
        content: JSON.stringify({
          currentDate: new Date().toISOString(),
          maximumSignals: AI_RESEARCH_LIMIT,
          activeCryptoInstrumentCatalog: universe,
        }),
      }],
      maxTokens: 1200,
      temperature: 0.2,
      rateKey: 'marketplace:official-trader',
      webSearch: true,
    });
    if (!Array.isArray(data?.signals) || data.signals.length > AI_RESEARCH_LIMIT) {
      throw new Error('AI returned an invalid official-trader research result');
    }

    const catalog = new Set(universe.map(({ symbol, marketType }) => `${symbol}:${marketType}`));
    const seen = new Set();
    return data.signals.map((signal) => {
      const normalizedSymbol = String(signal?.symbol || '').trim().toUpperCase();
      const marketType = signal?.marketType;
      const key = `${normalizedSymbol}:${marketType}`;
      const confidence = Number(signal?.confidence);
      const entry = positivePrice(signal?.entry);
      const stopLoss = positivePrice(signal?.stopLoss);
      const targets = Array.isArray(signal?.targets)
        ? signal.targets.map(positivePrice)
        : [];
      const sourceList = Array.isArray(signal?.sources)
        ? signal.sources.map(validateResearchSource)
        : [];
      const sources = [...new Map(sourceList.map((source) => [source.url, source])).values()];
      const analysis = typeof signal?.analysis === 'string' ? signal.analysis.trim().slice(0, 1500) : '';

      if (!catalog.has(key) || seen.has(key)) {
        throw new Error('AI returned a symbol outside the catalog or duplicated a research signal');
      }
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1 ||
          !['long', 'short'].includes(signal.direction) ||
          (signal.direction === 'short' && marketType !== 'futures') ||
          entry === null || stopLoss === null || targets.length === 0 || targets.length > 3 ||
          targets.some((target) => target === null) ||
          !hasValidRiskReward(signal.direction, entry, stopLoss, targets) ||
          analysis.length === 0 || sources.length < 2) {
        throw new Error('AI returned an invalid or unsupported official-trader trade idea');
      }
      seen.add(key);
      return {
        normalized_symbol: normalizedSymbol,
        market_type: marketType,
        confidence,
        direction: signal.direction,
        entry: String(entry),
        stopLoss: String(stopLoss),
        targets: targets.map(String),
        analysis,
        sources,
      };
    });
  }

  return { scanNow };
}

function selectResearchUniverse(universe, time = Date.now()) {
  if (universe.length <= AI_RESEARCH_UNIVERSE_LIMIT) return universe;
  const batchCount = Math.ceil(universe.length / AI_RESEARCH_UNIVERSE_LIMIT);
  const batchIndex = Math.floor(time / AI_RESEARCH_ROTATION_MS) % batchCount;
  const start = batchIndex * AI_RESEARCH_UNIVERSE_LIMIT;
  return Array.from(
    { length: AI_RESEARCH_UNIVERSE_LIMIT },
    (_, index) => universe[(start + index) % universe.length],
  );
}

function positivePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function hasValidRiskReward(direction, entry, stopLoss, targets) {
  const risk = direction === 'long' ? entry - stopLoss : stopLoss - entry;
  if (risk <= 0) return false;
  return targets.every((target) => {
    const reward = direction === 'long' ? target - entry : entry - target;
    return reward > 0 && reward / risk >= 1.5;
  });
}

function validateResearchSource(source) {
  const title = typeof source?.title === 'string' ? source.title.trim().slice(0, 200) : '';
  let url;
  try {
    url = new URL(source?.url);
  } catch {
    throw new Error('AI returned a malformed research source URL');
  }
  if (!title || url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('AI returned an invalid research source');
  }
  return { title, url: url.toString() };
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

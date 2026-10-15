/**
 * SyncExc Server — Deterministic parser service
 *
 * Runs versioned parsers against message content. Parsers return structured
 * candidates or null if they cannot resolve.
 */

export function createParserService({ db, queries, logger }) {
  // Registered parser implementations by name
  const parsers = new Map();

  /**
   * Template parser: handles well-structured signals like:
   *   "BTC/USDT Long Entry 60000-60200 SL 59000 TP1 61000 TP2 61500"
   */
  function templateParser(content) {
    const result = {
      instrument: null,
      direction: null,
      entry: null,
      entryRange: null,
      stopLoss: null,
      targets: [],
      leverage: null,
    };

    // Extract instrument (BTC/USDT or BTCUSDT)
    const instrumentMatch = content.match(/\b([A-Z]{2,10})[\/-]?(USDT|USD|USDC|BTC|ETH)\b/i);
    if (instrumentMatch) {
      result.instrument = `${instrumentMatch[1].toUpperCase()}/${instrumentMatch[2].toUpperCase()}`;
    }

    // Direction
    if (/\b(long|buy|bullish)\b/i.test(content)) result.direction = 'long';
    else if (/\b(short|sell|bearish)\b/i.test(content)) result.direction = 'short';

    // Entry range: "60000-60200" or "entry 60000 to 60200"
    const rangeMatch = content.match(/entry\s*[:\-]?\s*([\d.]+)\s*[-\s]+([\d.]+)/i);
    if (rangeMatch) {
      result.entryRange = { min: rangeMatch[1], max: rangeMatch[2] };
    } else {
      const entryMatch = content.match(/entry\s*[:\-]?\s*([\d.]+)/i);
      if (entryMatch) result.entry = entryMatch[1];
    }

    // Stop loss
    const slMatch = content.match(/\b(?:sl|stop\s*loss)\s*[:\-]?\s*([\d.]+)/i);
    if (slMatch) result.stopLoss = slMatch[1];

    // Targets
    const targetMatches = content.matchAll(/\b(?:tp\d?|target\s*\d?)\s*[:\-]?\s*([\d.]+)/gi);
    for (const m of targetMatches) {
      result.targets.push(m[1]);
    }

    // Leverage
    const leverageMatch = content.match(/\b(?:leverage|lev|x)\s*[:\-]?\s*(\d+)\s*x?\b/i);
    if (leverageMatch) result.leverage = leverageMatch[1];

    return result;
  }

  // Register the built-in template parser
  parsers.set('template', {
    name: 'template',
    version: 'v1',
    parse: templateParser,
  });

  /**
   * Parse a message by running all registered parsers and choosing the
   * best result based on how many fields were extracted.
   */
  async function parseMessage(messageId) {
    const message = await queries.findMessageById(messageId);
    if (!message) return null;

    const candidates = [];
    for (const [name, parser] of parsers.entries()) {
      try {
        const result = parser.parse(message.content);
        const score = countExtractedFields(result);
        if (score > 0) {
          candidates.push({ parser: name, parserVersion: parser.version, result, score });
        }
      } catch (err) {
        logger.warn({ err, parser: name, messageId }, 'Parser failed');
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Pick the best candidate
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  function countExtractedFields(result) {
    let count = 0;
    if (result.instrument) count += 1;
    if (result.direction) count += 1;
    if (result.entry) count += 1;
    if (result.entryRange) count += 1;
    if (result.stopLoss) count += 1;
    if (result.targets?.length > 0) count += 1;
    if (result.leverage) count += 1;
    return count;
  }

  return {
    parseMessage,
    registerParser(name, parser) {
      parsers.set(name, parser);
    },
    listParsers() {
      return Array.from(parsers.keys());
    },
  };
}

export default createParserService;
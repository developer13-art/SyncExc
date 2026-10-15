/**
 * SyncExc Shared Validators
 *
 * Standalone field validators. Return { valid: boolean, error?: string }.
 * Used in client forms (inline validation) and server services (pre-checks).
 */

/* =============================================================================
 * EMAIL
 * ========================================================================== */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  if (typeof email !== 'string') return { valid: false, error: 'Email must be a string' };
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { valid: false, error: 'Email is required' };
  if (trimmed.length > 254) return { valid: false, error: 'Email is too long' };
  if (!EMAIL_REGEX.test(trimmed)) return { valid: false, error: 'Email format is invalid' };
  return { valid: true };
}

/* =============================================================================
 * PASSWORD
 * ========================================================================== */

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'letmein123', 'welcome123', 'admin123', 'iloveyou', 'monkey123',
  'dragon123', 'abc123456', 'password!', 'admin@123', 'changeme123', 'qwertyuiop',
]);

export function validatePassword(password) {
  if (typeof password !== 'string') return { valid: false, error: 'Password must be a string' };
  if (password.length < 12) return { valid: false, error: 'Password must be at least 12 characters' };
  if (password.length > 128) return { valid: false, error: 'Password must be at most 128 characters' };
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must contain a lowercase letter' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain an uppercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must contain a digit' };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: 'Password must contain a special character' };
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common' };
  }
  return { valid: true };
}

export function passwordStrength(password) {
  if (typeof password !== 'string' || password.length === 0) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 20) score += 1;
  return Math.min(score, 8);
}

/* =============================================================================
 * USERNAME
 * ========================================================================== */

const USERNAME_REGEX = /^[a-z0-9_][a-z0-9_-]*[a-z0-9_]$/;
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'syncexc', 'support', 'help',
  'api', 'www', 'mail', 'ftp', 'localhost', 'null', 'undefined', 'moderator',
  'official', 'staff', 'team', 'security', 'billing',
]);

export function validateUsername(username) {
  if (typeof username !== 'string') return { valid: false, error: 'Username must be a string' };
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (trimmed.length > 32) return { valid: false, error: 'Username must be at most 32 characters' };
  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Username must start and end with a letter or number, and may contain hyphens and underscores',
    };
  }
  if (RESERVED_USERNAMES.has(trimmed)) return { valid: false, error: 'This username is reserved' };
  return { valid: true };
}

/* =============================================================================
 * PHONE (E.164)
 * ========================================================================== */

const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export function validatePhone(phone) {
  if (typeof phone !== 'string') return { valid: false, error: 'Phone must be a string' };
  const trimmed = phone.trim();
  if (!trimmed) return { valid: false, error: 'Phone is required' };
  if (!PHONE_REGEX.test(trimmed)) {
    return { valid: false, error: 'Phone must be in E.164 format (e.g., +1234567890)' };
  }
  return { valid: true };
}

/* =============================================================================
 * SYMBOL / INSTRUMENT
 * ========================================================================== */

const SYMBOL_REGEX = /^[A-Z0-9]{2,20}([-/][A-Z0-9]{2,20})?$/;

export function validateSymbol(symbol) {
  if (typeof symbol !== 'string') return { valid: false, error: 'Symbol must be a string' };
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) return { valid: false, error: 'Symbol is required' };
  if (trimmed.length > 40) return { valid: false, error: 'Symbol is too long' };
  if (!SYMBOL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Symbol format is invalid' };
  }
  return { valid: true };
}

export function validateInstrument(instrument) {
  if (typeof instrument !== 'string') return { valid: false, error: 'Instrument must be a string' };
  const trimmed = instrument.trim().toUpperCase();
  if (!trimmed) return { valid: false, error: 'Instrument is required' };
  if (trimmed.length > 64) return { valid: false, error: 'Instrument is too long' };
  if (!/^[A-Z0-9][A-Z0-9:/\-_]*$/.test(trimmed)) {
    return { valid: false, error: 'Instrument contains invalid characters' };
  }
  return { valid: true };
}

export function extractInstrument(value) {
  if (typeof value !== 'string') return null;
  const candidate = value
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .match(/[A-Z0-9]{2,20}(?:[/:_-][A-Z0-9]{2,20})?/)?.[0];
  return candidate && validateInstrument(candidate).valid ? candidate : null;
}

export function normalizeDirection(value) {
  if (typeof value !== 'string') return null;
  const direction = value.trim().toLowerCase();
  if (['long', 'buy', 'bullish'].includes(direction)) return 'long';
  if (['short', 'sell', 'bearish'].includes(direction)) return 'short';
  return null;
}

/* =============================================================================
 * PRICE / QUANTITY
 * ========================================================================== */

const DECIMAL_REGEX = /^-?\d+(\.\d+)?$/;

export function validatePrice(price) {
  if (price === null || price === undefined || price === '') {
    return { valid: false, error: 'Price is required' };
  }
  const str = String(price).trim();
  if (!DECIMAL_REGEX.test(str)) return { valid: false, error: 'Price must be a valid decimal number' };
  if (str.length > 64) return { valid: false, error: 'Price is too long' };
  const num = Number(str);
  if (!Number.isFinite(num)) return { valid: false, error: 'Price must be finite' };
  if (num <= 0) return { valid: false, error: 'Price must be greater than zero' };
  return { valid: true };
}

export function validateQuantity(quantity) {
  if (quantity === null || quantity === undefined || quantity === '') {
    return { valid: false, error: 'Quantity is required' };
  }
  const str = String(quantity).trim();
  if (!DECIMAL_REGEX.test(str)) return { valid: false, error: 'Quantity must be a valid decimal number' };
  if (str.length > 64) return { valid: false, error: 'Quantity is too long' };
  const num = Number(str);
  if (!Number.isFinite(num)) return { valid: false, error: 'Quantity must be finite' };
  if (num <= 0) return { valid: false, error: 'Quantity must be greater than zero' };
  return { valid: true };
}

export function validateDecimal(value, { min, max, allowNegative = true } = {}) {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: 'Value is required' };
  }
  const str = String(value).trim();
  if (!DECIMAL_REGEX.test(str)) return { valid: false, error: 'Value must be a valid decimal number' };
  const num = Number(str);
  if (!Number.isFinite(num)) return { valid: false, error: 'Value must be finite' };
  if (!allowNegative && num < 0) return { valid: false, error: 'Value cannot be negative' };
  if (min !== undefined && num < min) return { valid: false, error: `Value must be at least ${min}` };
  if (max !== undefined && num > max) return { valid: false, error: `Value must be at most ${max}` };
  return { valid: true };
}

/* =============================================================================
 * CURRENCY
 * ========================================================================== */

const CURRENCY_REGEX = /^[A-Z]{3,10}$/;

export function validateCurrency(currency) {
  if (typeof currency !== 'string') return { valid: false, error: 'Currency must be a string' };
  const trimmed = currency.trim().toUpperCase();
  if (!trimmed) return { valid: false, error: 'Currency is required' };
  if (!CURRENCY_REGEX.test(trimmed)) {
    return { valid: false, error: 'Currency must be 3-10 uppercase letters' };
  }
  return { valid: true };
}

/* =============================================================================
 * TIMEFRAME
 * ========================================================================== */

const VALID_TIMEFRAMES = new Set([
  '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w', '1M',
]);

export function validateTimeframe(timeframe) {
  if (typeof timeframe !== 'string') return { valid: false, error: 'Timeframe must be a string' };
  if (!VALID_TIMEFRAMES.has(timeframe)) {
    return { valid: false, error: 'Timeframe is not supported' };
  }
  return { valid: true };
}

/* =============================================================================
 * URL
 * ========================================================================== */

export function validateUrl(url, { requireHttps = false } = {}) {
  if (typeof url !== 'string') return { valid: false, error: 'URL must be a string' };
  const trimmed = url.trim();
  if (!trimmed) return { valid: false, error: 'URL is required' };
  if (trimmed.length > 2048) return { valid: false, error: 'URL is too long' };
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'URL format is invalid' };
  }
  if (requireHttps && parsed.protocol !== 'https:') {
    return { valid: false, error: 'URL must use HTTPS' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'URL must use HTTP or HTTPS' };
  }
  return { valid: true };
}

/* =============================================================================
 * WALLET ADDRESS (basic EVM + Solana)
 * ========================================================================== */

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateWalletAddress(address, { chain = 'any' } = {}) {
  if (typeof address !== 'string') return { valid: false, error: 'Address must be a string' };
  const trimmed = address.trim();
  if (!trimmed) return { valid: false, error: 'Address is required' };

  if (chain === 'evm' || chain === 'ethereum') {
    if (!EVM_ADDRESS_REGEX.test(trimmed)) return { valid: false, error: 'Invalid EVM address' };
    return { valid: true };
  }

  if (chain === 'solana') {
    if (!SOLANA_ADDRESS_REGEX.test(trimmed)) return { valid: false, error: 'Invalid Solana address' };
    return { valid: true };
  }

  if (EVM_ADDRESS_REGEX.test(trimmed) || SOLANA_ADDRESS_REGEX.test(trimmed)) {
    return { valid: true };
  }
  return { valid: false, error: 'Address does not match a supported format' };
}

/* =============================================================================
 * SIGNAL PAYLOAD
 * ========================================================================== */

export function validateSignalPayload(signal) {
  const errors = [];

  if (!signal || typeof signal !== 'object') {
    return { valid: false, error: 'Signal must be an object', errors: ['Signal must be an object'] };
  }

  const instrument = validateInstrument(signal.instrument);
  if (!instrument.valid) errors.push(`instrument: ${instrument.error}`);

  if (!['long', 'short'].includes(signal.direction)) {
    errors.push('direction: must be "long" or "short"');
  }

  if (signal.entry !== undefined && signal.entry !== null) {
    const entry = validatePrice(signal.entry);
    if (!entry.valid) errors.push(`entry: ${entry.error}`);
  }

  if (signal.entryRange) {
    const min = validatePrice(signal.entryRange.min);
    const max = validatePrice(signal.entryRange.max);
    if (!min.valid) errors.push(`entryRange.min: ${min.error}`);
    if (!max.valid) errors.push(`entryRange.max: ${max.error}`);
    if (min.valid && max.valid && Number(signal.entryRange.min) > Number(signal.entryRange.max)) {
      errors.push('entryRange: min must be <= max');
    }
  }

  if (signal.stopLoss !== undefined && signal.stopLoss !== null) {
    const sl = validatePrice(signal.stopLoss);
    if (!sl.valid) errors.push(`stopLoss: ${sl.error}`);
  }

  if (Array.isArray(signal.targets)) {
    signal.targets.forEach((target, idx) => {
      const t = validatePrice(target);
      if (!t.valid) errors.push(`targets[${idx}]: ${t.error}`);
    });
  }

  return { valid: errors.length === 0, errors };
}

/* =============================================================================
 * ORDER PAYLOAD
 * ========================================================================== */

export function validateOrderPayload(order) {
  const errors = [];

  if (!order || typeof order !== 'object') {
    return { valid: false, errors: ['Order must be an object'] };
  }

  if (!['buy', 'sell'].includes(order.side)) {
    errors.push('side: must be "buy" or "sell"');
  }

  const validTypes = ['market', 'limit', 'stop_market', 'stop_limit', 'take_profit_market', 'take_profit_limit'];
  if (!validTypes.includes(order.type)) {
    errors.push(`type: must be one of ${validTypes.join(', ')}`);
  }

  const qty = validateQuantity(order.quantity);
  if (!qty.valid) errors.push(`quantity: ${qty.error}`);

  if (['limit', 'stop_limit', 'take_profit_limit'].includes(order.type)) {
    if (order.price === undefined || order.price === null) {
      errors.push('price: required for limit-type orders');
    } else {
      const price = validatePrice(order.price);
      if (!price.valid) errors.push(`price: ${price.error}`);
    }
  }

  if (['stop_market', 'stop_limit', 'take_profit_market', 'take_profit_limit'].includes(order.type)) {
    if (order.triggerPrice === undefined || order.triggerPrice === null) {
      errors.push('triggerPrice: required for trigger-type orders');
    } else {
      const tp = validatePrice(order.triggerPrice);
      if (!tp.valid) errors.push(`triggerPrice: ${tp.error}`);
    }
  }

  const instrument = validateInstrument(order.instrumentId);
  if (!instrument.valid) errors.push(`instrumentId: ${instrument.error}`);

  return { valid: errors.length === 0, errors };
}

/* =============================================================================
 * WEBHOOK PAYLOAD
 * ========================================================================== */

export function validateWebhookPayload(payload, signature, secret, timestamp) {
  const errors = [];

  if (!payload) errors.push('payload: required');
  if (!signature) errors.push('signature: required');
  if (!secret) errors.push('secret: required');
  if (!timestamp) errors.push('timestamp: required');

  if (timestamp) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      errors.push('timestamp: must be numeric');
    } else {
      const now = Math.floor(Date.now() / 1000);
      const age = Math.abs(now - ts);
      if (age > 300) errors.push('timestamp: too old or in the future (max 5 min skew)');
    }
  }

  return { valid: errors.length === 0, errors };
}

/* =============================================================================
 * UTILITY
 * ========================================================================== */

export function validatePagination({ limit, cursor } = {}) {
  const errors = [];
  if (limit !== undefined) {
    const n = Number(limit);
    if (!Number.isInteger(n)) errors.push('limit: must be an integer');
    else if (n < 1) errors.push('limit: must be at least 1');
    else if (n > 200) errors.push('limit: must be at most 200');
  }
  if (cursor !== undefined && typeof cursor !== 'string') {
    errors.push('cursor: must be a string');
  }
  return { valid: errors.length === 0, errors };
}

export function validateDateRange(start, end) {
  const errors = [];
  if (!start) errors.push('start: required');
  if (!end) errors.push('end: required');
  if (start && end) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isFinite(s)) errors.push('start: invalid date');
    if (!Number.isFinite(e)) errors.push('end: invalid date');
    if (s && e && s >= e) errors.push('start must be before end');
  }
  return { valid: errors.length === 0, errors };
}

/* =============================================================================
 * EXPORTS MAP
 * ========================================================================== */

export const VALIDATORS = Object.freeze({
  validateEmail,
  validatePassword,
  passwordStrength,
  validateUsername,
  validatePhone,
  validateSymbol,
  validateInstrument,
  validatePrice,
  validateQuantity,
  validateDecimal,
  validateCurrency,
  validateTimeframe,
  validateUrl,
  validateWalletAddress,
  validateSignalPayload,
  validateOrderPayload,
  validateWebhookPayload,
  validatePagination,
  validateDateRange,
});
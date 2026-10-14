const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  NGN: '₦',
  ZAR: 'R',
  KES: 'KSh',
  GHS: 'GH₵',
  USDT: '₮',
  USDC: '$',
  BTC: '₿',
  ETH: 'Ξ',
};

const CRYPTO_CURRENCIES = new Set(['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL']);

export function formatCurrency(value, currency = 'USD', options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
    compact = false,
  } = options;

  const numeric = toNumber(value);
  if (numeric === null) {
    return '—';
  }

  const isCrypto = CRYPTO_CURRENCIES.has(currency.toUpperCase());

  if (compact) {
    return `${showSymbol ? getCurrencySymbol(currency) : ''}${numeric.toLocaleString('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
      minimumFractionDigits,
      maximumFractionDigits,
    })}`;
  }

  const formatted = numeric.toLocaleString('en-US', {
    minimumFractionDigits: isCrypto ? 4 : minimumFractionDigits,
    maximumFractionDigits: isCrypto ? 8 : maximumFractionDigits,
  });

  return showSymbol ? `${getCurrencySymbol(currency)}${formatted}` : formatted;
}

export function formatCurrencyParts(value, currency = 'USD') {
  const numeric = toNumber(value);
  if (numeric === null) {
    return { symbol: '', value: '—', sign: '', isNegative: false };
  }
  const isNegative = numeric < 0;
  return {
    symbol: getCurrencySymbol(currency),
    value: formatCurrency(Math.abs(numeric), currency, { showSymbol: false }),
    sign: isNegative ? '-' : '',
    isNegative,
  };
}

export function getCurrencySymbol(currency) {
  if (!currency) {
    return '';
  }
  const upper = currency.toUpperCase();
  return CURRENCY_SYMBOLS[upper] ?? `${upper} `;
}

export function formatPrice(value, options = {}) {
  const { precision, minimumPrecision = 2, maximumPrecision = 8 } = options;
  const numeric = toNumber(value);
  if (numeric === null) {
    return '—';
  }

  if (typeof precision === 'number') {
    return numeric.toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }

  const abs = Math.abs(numeric);
  let digits = maximumPrecision;
  if (abs >= 1000) {
    digits = 2;
  } else if (abs >= 1) {
    digits = 4;
  } else if (abs >= 0.01) {
    digits = 6;
  } else {
    digits = 8;
  }
  digits = Math.max(minimumPrecision, Math.min(maximumPrecision, digits));

  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: minimumPrecision,
    maximumFractionDigits: digits,
  });
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return null;
}
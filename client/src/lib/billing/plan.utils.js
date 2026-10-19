function getMinorUnitDigits(currency) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function formatFeatureName(name) {
  return name
    .replace(/\.enabled$/i, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return plan;
  }

  const prices = Array.isArray(plan.prices) ? plan.prices : [];
  const price =
    prices.find((item) => item.billingInterval === 'monthly') ?? prices[0];
  const rawAmountMinor = price?.amountMinor;
  const amountMinor =
    rawAmountMinor === null || rawAmountMinor === undefined || rawAmountMinor === ''
      ? null
      : Number(rawAmountMinor);
  const features = Array.isArray(plan.features)
    ? plan.features
    : Object.entries(plan.features ?? {})
        .filter(([, enabled]) => enabled === true)
        .map(([name]) => ({ label: formatFeatureName(name) }));

  return {
    ...plan,
    ...(price
      ? {
          price: amountMinor !== null && Number.isFinite(amountMinor)
            ? amountMinor / 10 ** getMinorUnitDigits(price.currency)
            : null,
          currency: price.currency,
          billingInterval: price.billingInterval === 'yearly' ? 'year' : 'month',
        }
      : {}),
    features,
  };
}

export function normalizePlans(plans) {
  return Array.isArray(plans) ? plans.map(normalizePlan) : [];
}

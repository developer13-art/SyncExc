import { ValidationError } from './errors.js';

function decimalParts(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const [integer, fraction = ''] = text.split('.');
  return { integer, fraction };
}

function toScaledInteger({ integer, fraction }, scale) {
  return BigInt(`${integer}${fraction.padEnd(scale, '0')}`);
}

function formatScaledInteger(value, scale) {
  if (scale === 0) return value.toString();
  const digits = value.toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export function normalizeOrderQuantity(quantity, quantityStep, minimumQuantity = null) {
  const requested = decimalParts(quantity);
  const step = decimalParts(quantityStep);
  const minimum = minimumQuantity == null ? null : decimalParts(minimumQuantity);

  if (!requested || !step || (minimumQuantity != null && !minimum)) {
    throw new ValidationError('Order quantity or exchange quantity rules are invalid');
  }

  const scale = Math.max(
    requested.fraction.length,
    step.fraction.length,
    minimum?.fraction.length ?? 0,
  );
  if (scale > 18) {
    throw new ValidationError('Order quantity exceeds the supported decimal precision');
  }

  const requestedValue = toScaledInteger(requested, scale);
  const stepValue = toScaledInteger(step, scale);
  if (requestedValue <= 0n || stepValue <= 0n) {
    throw new ValidationError('Order quantity and exchange quantity step must be positive');
  }

  const normalizedValue = (requestedValue / stepValue) * stepValue;
  if (normalizedValue <= 0n) {
    throw new ValidationError('Order quantity is below the exchange minimum quantity step');
  }

  if (minimum) {
    const minimumValue = toScaledInteger(minimum, scale);
    if (normalizedValue < minimumValue) {
      throw new ValidationError(
        `Order quantity ${formatScaledInteger(normalizedValue, scale)} is below the exchange minimum quantity ${minimumQuantity}`,
      );
    }
  }

  return formatScaledInteger(normalizedValue, scale);
}

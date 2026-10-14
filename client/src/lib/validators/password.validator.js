const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  'password123',
  'password1234',
  'qwerty123456',
  'letmein123456',
  'admin1234567',
  'welcome123456',
  '123456789012',
  'qwertyuiop12',
]);

export function checkPasswordStrength(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return { score: 0, label: 'Empty', checks: {} };
  }

  const checks = {
    length: value.length >= MIN_LENGTH,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^a-zA-Z0-9]/.test(value),
    noCommonPattern: !COMMON_PASSWORDS.has(value.toLowerCase()),
    notAllSame: !/^(.)\1+$/.test(value),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const score = Math.round((passed / total) * 4);

  let label = 'Weak';
  if (score >= 4) {
    label = 'Strong';
  } else if (score === 3) {
    label = 'Good';
  } else if (score === 2) {
    label = 'Fair';
  }

  return { score, label, checks };
}

export function validatePassword(value) {
  if (typeof value !== 'string') {
    return { valid: false, errors: ['Password must be a string'] };
  }

  const errors = [];

  if (value.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`);
  }
  if (value.length > MAX_LENGTH) {
    errors.push(`Password must not exceed ${MAX_LENGTH} characters`);
  }
  if (!/[a-z]/.test(value)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(value)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(value)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^a-zA-Z0-9]/.test(value)) {
    errors.push('Password must contain at least one special character');
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    errors.push('This password is too common');
  }
  if (/^(.)\1+$/.test(value)) {
    errors.push('Password cannot be a single repeated character');
  }

  return { valid: errors.length === 0, errors };
}

export const passwordValidator = {
  required: 'Password is required',
  minLength: MIN_LENGTH,
  maxLength: MAX_LENGTH,
  validate: (value) => {
    const result = validatePassword(value);
    return result.valid || result.errors[0];
  },
};
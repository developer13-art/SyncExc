const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return false;
  }
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) {
    return false;
  }
  if (local.length > 64) {
    return false;
  }
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return false;
  }
  return true;
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export const emailValidator = {
  required: 'Email address is required',
  validate: (value) => isValidEmail(value) || 'Please enter a valid email address',
};
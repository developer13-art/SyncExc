export function required(message = 'This field is required') {
  return (value) => {
    if (value === null || value === undefined) {
      return message;
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return message;
    }
    if (Array.isArray(value) && value.length === 0) {
      return message;
    }
    return true;
  };
}

export function minLength(min, message) {
  return (value) => {
    if (typeof value !== 'string') {
      return true;
    }
    if (value.length < min) {
      return message ?? `Must be at least ${min} characters`;
    }
    return true;
  };
}

export function maxLength(max, message) {
  return (value) => {
    if (typeof value !== 'string') {
      return true;
    }
    if (value.length > max) {
      return message ?? `Must not exceed ${max} characters`;
    }
    return true;
  };
}

export function pattern(regex, message) {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return true;
    }
    return regex.test(String(value)) || message;
  };
}

export function minNumber(min, message) {
  return (value) => {
    if (value === '' || value === null || value === undefined) {
      return true;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < min) {
      return message ?? `Must be at least ${min}`;
    }
    return true;
  };
}

export function maxNumber(max, message) {
  return (value) => {
    if (value === '' || value === null || value === undefined) {
      return true;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric > max) {
      return message ?? `Must not exceed ${max}`;
    }
    return true;
  };
}

export function matches(otherFieldName, message = 'Values do not match') {
  return (value, formValues) => {
    if (value !== formValues[otherFieldName]) {
      return message;
    }
    return true;
  };
}

export function compose(...validators) {
  return (value, formValues) => {
    for (const validator of validators) {
      const result = validator(value, formValues);
      if (result !== true) {
        return result;
      }
    }
    return true;
  };
}

export function runValidators(validators, value, formValues) {
  for (const validator of validators) {
    const result = validator(value, formValues);
    if (result !== true) {
      return result;
    }
  }
  return true;
}

export function isValidUrl(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidHexColor(value) {
  return typeof value === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

export function isValidUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
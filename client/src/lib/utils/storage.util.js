function getStorage(type = 'local') {
  try {
    return type === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export const storage = {
  get(key, defaultValue = null, { type = 'local', parse = true } = {}) {
    const store = getStorage(type);
    if (!store) {
      return defaultValue;
    }
    try {
      const raw = store.getItem(key);
      if (raw === null) {
        return defaultValue;
      }
      return parse ? JSON.parse(raw) : raw;
    } catch {
      return defaultValue;
    }
  },

  set(key, value, { type = 'local', stringify = true } = {}) {
    const store = getStorage(type);
    if (!store) {
      return false;
    }
    try {
      const raw = stringify ? JSON.stringify(value) : String(value);
      store.setItem(key, raw);
      return true;
    } catch {
      return false;
    }
  },

  remove(key, { type = 'local' } = {}) {
    const store = getStorage(type);
    if (!store) {
      return false;
    }
    try {
      store.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear({ type = 'local' } = {}) {
    const store = getStorage(type);
    if (!store) {
      return false;
    }
    try {
      store.clear();
      return true;
    } catch {
      return false;
    }
  },
};

export const STORAGE_KEYS = Object.freeze({
  AUTH_TOKEN: 'syncexc:auth-token',
  AUTH_USER: 'syncexc:auth-user',
  ACTIVE_WORKSPACE: 'syncexc:active-workspace',
  THEME: 'syncexc:theme:v2',
  SIDEBAR_COLLAPSED: 'syncexc:sidebar-collapsed',
  DENSITY: 'syncexc:density',
  LAST_ROUTE: 'syncexc:last-route',
});

export function clearDevelopmentDemoSession() {
  const token = storage.get(STORAGE_KEYS.AUTH_TOKEN, null, { parse: false });
  if (!import.meta.env.DEV || token !== 'demo-access-token-123') {
    return false;
  }

  storage.remove(STORAGE_KEYS.AUTH_TOKEN);
  storage.remove(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`);
  storage.remove(STORAGE_KEYS.AUTH_USER);
  if (
    storage.get(STORAGE_KEYS.ACTIVE_WORKSPACE, null, { parse: false }) ===
    'demo-workspace'
  ) {
    storage.remove(STORAGE_KEYS.ACTIVE_WORKSPACE);
  }
  return true;
}
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
  AUTH_TOKEN: 'syncexc:admin:auth-token',
  AUTH_ADMIN: 'syncexc:admin:auth-admin',
  THEME: 'syncexc:admin:theme',
  SIDEBAR_COLLAPSED: 'syncexc:admin:sidebar-collapsed',
  LAST_ROUTE: 'syncexc:admin:last-route',
  SAVED_VIEWS: 'syncexc:admin:saved-views',
  DASHBOARD_PREFERENCES: 'syncexc:admin:dashboard-preferences',
});
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
  DEMO_CREDENTIALS: 'syncexc:demo-credentials',
});

export const DEMO_CREDENTIALS = Object.freeze({
  email: 'demo@syncexc.com',
  password: 'DemoPass123!',
  name: 'Demo User',
  username: 'demo-user',
});

export const DEMO_USER = Object.freeze({
  id: 'demo-user-id',
  name: DEMO_CREDENTIALS.name,
  username: DEMO_CREDENTIALS.username,
  email: DEMO_CREDENTIALS.email,
  avatarUrl: null,
  role: 'owner',
  workspaceId: 'demo-workspace',
  emailVerifiedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function ensureDemoCredentials() {
  const existing = storage.get(STORAGE_KEYS.DEMO_CREDENTIALS, null);
  if (existing && existing.email && existing.password) {
    return existing;
  }

  const seeded = {
    email: DEMO_CREDENTIALS.email,
    password: DEMO_CREDENTIALS.password,
  };

  storage.set(STORAGE_KEYS.DEMO_CREDENTIALS, seeded);
  return seeded;
}

export function seedDemoAuthSession() {
  if (!import.meta.env.DEV) {
    return null;
  }

  const payload = {
    user: { ...DEMO_USER },
    accessToken: 'demo-access-token-123',
    refreshToken: 'demo-refresh-token-123',
  };

  storage.set(STORAGE_KEYS.AUTH_TOKEN, payload.accessToken, { stringify: false });
  storage.set(`${STORAGE_KEYS.AUTH_TOKEN}:refresh`, payload.refreshToken, {
    stringify: false,
  });
  storage.set(STORAGE_KEYS.AUTH_USER, payload.user);

  return payload;
}
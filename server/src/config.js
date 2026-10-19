/**
 * SyncExc Server — Configuration
 *
 * Loads every environment variable the server needs, validates them at boot,
 * and exports a frozen config object. Any missing required variable causes
 * the process to exit before it starts serving traffic.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Joi from 'joi';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDirectory, '../.env') });
dotenv.config({ path: path.resolve(configDirectory, '../../.env') });

/* =============================================================================
 * SCHEMA — full environment contract
 * ========================================================================== */

const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  APP_NAME: Joi.string().default('SyncExc'),
  APP_URL: Joi.string().uri().default('http://localhost:5173'),
  APP_DOMAIN: Joi.string().default('syncexc.com'),
  APP_TIMEZONE: Joi.string().default('UTC'),
  APP_DEFAULT_LOCALE: Joi.string().default('en'),

  // Server
  PORT: Joi.number().integer().min(1).max(65535).optional(),
  SERVER_PORT: Joi.number().integer().min(1).max(65535).default(4000),
  SERVER_HOST: Joi.string().default('0.0.0.0'),
  SERVER_BASE_URL: Joi.string().uri().default('http://localhost:4000'),
  SERVER_API_PREFIX: Joi.string().pattern(/^\//).default('/api/v1'),
  SERVER_CORS_ORIGINS: Joi.string().default('http://localhost:5173,http://localhost:5174'),

  // Database
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_MIN: Joi.number().integer().min(0).default(2),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(20),
  DATABASE_STATEMENT_TIMEOUT: Joi.number().integer().default(30000),
  DATABASE_IDLE_TIMEOUT: Joi.number().integer().default(10000),

  // JWT & Session
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),
  SESSION_SECRET: Joi.string().min(32).required(),
  SESSION_COOKIE_NAME: Joi.string().default('syncexc_session'),
  SESSION_COOKIE_DOMAIN: Joi.string().allow('').default('localhost'),
  SESSION_COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SESSION_COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').default('lax'),
  SESSION_TTL: Joi.string().default('30d'),

  // Password hashing
  BCRYPT_ROUNDS: Joi.number().integer().min(8).max(15).default(12),

  // Encryption
  ENCRYPTION_MASTER_KEY: Joi.string().required(),
  ENCRYPTION_KEY_VERSION: Joi.string().default('1'),

  // SMTP
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().integer().min(1).max(65535).default(587),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  SMTP_FROM_NAME: Joi.string().default('SyncExc'),
  SMTP_FROM_EMAIL: Joi.string().email().default('noreply@syncexc.com'),

  // IMAP
  IMAP_HOST: Joi.string().allow('').optional(),
  IMAP_PORT: Joi.number().integer().default(993),
  IMAP_SECURE: Joi.boolean().truthy('true').falsy('false').default(true),
  IMAP_USER: Joi.string().allow('').optional(),
  IMAP_PASSWORD: Joi.string().allow('').optional(),
  IMAP_POLL_INTERVAL_MS: Joi.number().integer().default(30000),

  // Telegram user sessions
  TELEGRAM_API_ID: Joi.number().integer().positive().optional(),
  TELEGRAM_API_HASH: Joi.string().allow('').optional(),

  // Push
  VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
  VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),
  VAPID_SUBJECT: Joi.string().default('mailto:admin@syncexc.com'),

  // AI
  AI_PROVIDER: Joi.string().valid('openai', 'anthropic', 'google', 'local').default('openai'),
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: Joi.number().integer().default(4096),
  ANTHROPIC_API_KEY: Joi.string().allow('').optional(),
  ANTHROPIC_MODEL: Joi.string().default('claude-3-5-sonnet-20241022'),
  GOOGLE_AI_API_KEY: Joi.string().allow('').optional(),
  GOOGLE_AI_MODEL: Joi.string().default('gemini-1.5-flash'),
  LOCAL_LLM_BASE_URL: Joi.string().uri().default('http://localhost:11434'),
  LOCAL_LLM_MODEL: Joi.string().default('llama3.1'),
  AI_REQUEST_TIMEOUT_MS: Joi.number().integer().default(60000),
  AI_MAX_RETRIES: Joi.number().integer().min(0).max(10).default(3),
  AI_RATE_LIMIT_PER_MINUTE: Joi.number().integer().default(60),

  // Exchange adapters
  EXCHANGE_REQUEST_TIMEOUT_MS: Joi.number().integer().default(15000),
  EXCHANGE_MAX_RETRIES: Joi.number().integer().min(0).default(3),
  EXCHANGE_RATE_LIMIT_BUFFER_PCT: Joi.number().integer().default(20),
  EXCHANGE_WS_RECONNECT_BASE_MS: Joi.number().integer().default(1000),
  EXCHANGE_WS_RECONNECT_MAX_MS: Joi.number().integer().default(60000),

  // Payment providers
  STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().allow('').optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  PAYSTACK_SECRET_KEY: Joi.string().allow('').optional(),
  PAYSTACK_PUBLIC_KEY: Joi.string().allow('').optional(),
  PAYSTACK_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  FLUTTERWAVE_SECRET_KEY: Joi.string().allow('').optional(),
  FLUTTERWAVE_PUBLIC_KEY: Joi.string().allow('').optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  // Payout providers
  STRIPE_CONNECT_CLIENT_ID: Joi.string().allow('').optional(),
  STRIPE_CONNECT_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  // Storage
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_PATH: Joi.string().default('./storage'),
  S3_BUCKET: Joi.string().allow('').optional(),
  S3_REGION: Joi.string().allow('').default('us-east-1'),
  S3_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  S3_ENDPOINT: Joi.string().allow('').optional(),
  S3_FORCE_PATH_STYLE: Joi.boolean().truthy('true').falsy('false').default(false),
  UPLOAD_MAX_FILE_SIZE_MB: Joi.number().integer().default(25),
  UPLOAD_ALLOWED_MIME_TYPES: Joi.string().default(
    'image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,application/json',
  ),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().default(120),
  RATE_LIMIT_AUTH_MAX: Joi.number().integer().default(10),
  RATE_LIMIT_AI_MAX: Joi.number().integer().default(30),
  RATE_LIMIT_EXCHANGE_MAX: Joi.number().integer().default(60),

  // WebSocket
  WS_PATH: Joi.string().default('/ws'),
  WS_PING_INTERVAL_MS: Joi.number().integer().default(25000),
  WS_PING_TIMEOUT_MS: Joi.number().integer().default(60000),
  WS_MAX_CONNECTIONS_PER_USER: Joi.number().integer().default(10),

  // Jobs
  JOB_QUEUE_PREFIX: Joi.string().default('syncexc:jobs:'),
  JOB_MAX_ATTEMPTS: Joi.number().integer().default(5),
  JOB_BACKOFF_BASE_MS: Joi.number().integer().default(1000),
  JOB_BACKOFF_MAX_MS: Joi.number().integer().default(300000),
  JOB_WORKER_CONCURRENCY: Joi.number().integer().default(10),
  JOB_DEAD_LETTER_TTL_DAYS: Joi.number().integer().default(30),

  // Observability
  LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),
  LOG_FORMAT: Joi.string().valid('pretty', 'json').default('pretty'),
  LOG_FILE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  LOG_FILE_PATH: Joi.string().default('./logs'),
  METRICS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  METRICS_PATH: Joi.string().default('/metrics'),

  // Feature flags
  FEATURE_MARKETPLACE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  FEATURE_AUTOMATION_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  FEATURE_SIMULATION_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  FEATURE_REFERRAL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  FEATURE_COMMUNITY_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  FEATURE_DEVELOPER_API_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),

  // Security
  CSP_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  HSTS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
  HELMET_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),

  // Seed
  SEED_ADMIN_EMAIL: Joi.string().email().default('admin@syncexc.com'),
  SEED_ADMIN_PASSWORD: Joi.string().default('ChangeMe123!'),
  SEED_DEMO_DATA: Joi.boolean().truthy('true').falsy('false').default(false),
}).unknown(true);

/* =============================================================================
 * VALIDATION
 * ========================================================================== */

const { error, value: env } = envSchema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false,
});

if (error) {
  const messages = error.details.map((d) => `  - ${d.path.join('.')}: ${d.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nEnvironment validation failed:\n${messages}\n`);
  process.exit(1);
}

/* =============================================================================
 * CONFIG EXPORT
 * ========================================================================== */

const isProduction = env.NODE_ENV === 'production';
const isDevelopment = env.NODE_ENV === 'development';
const isTest = env.NODE_ENV === 'test';

function parseDuration(value) {
  if (typeof value === 'number') return value;

  const match = String(value).match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const [, num, unit] = match;
  const n = Number(num);
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return n * multipliers[unit];
}

const config = {
  env: env.NODE_ENV,
  isProduction,
  isDevelopment,
  isTest,

  app: {
    name: env.APP_NAME,
    url: env.APP_URL,
    domain: env.APP_DOMAIN,
    timezone: env.APP_TIMEZONE,
    defaultLocale: env.APP_DEFAULT_LOCALE,
  },

  server: {
    port: env.PORT || env.SERVER_PORT,
    host: env.SERVER_HOST,
    baseUrl: env.SERVER_BASE_URL,
    apiPrefix: env.SERVER_API_PREFIX,
    corsOrigins: env.SERVER_CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustProxy: env.TRUST_PROXY,
  },

  database: {
    url: env.DATABASE_URL,
    poolMin: env.DATABASE_POOL_MIN,
    poolMax: env.DATABASE_POOL_MAX,
    statementTimeout: env.DATABASE_STATEMENT_TIMEOUT,
    idleTimeout: env.DATABASE_IDLE_TIMEOUT,
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
    accessTtlMs: parseDuration(env.JWT_ACCESS_TTL),
    refreshTtlMs: parseDuration(env.JWT_REFRESH_TTL),
  },

  session: {
    secret: env.SESSION_SECRET,
    cookieName: env.SESSION_COOKIE_NAME,
    cookieDomain: env.SESSION_COOKIE_DOMAIN || undefined,
    cookieSecure: env.SESSION_COOKIE_SECURE,
    cookieSameSite: env.SESSION_COOKIE_SAME_SITE,
    ttl: env.SESSION_TTL,
    ttlMs: parseDuration(env.SESSION_TTL),
  },

  password: {
    bcryptRounds: env.BCRYPT_ROUNDS,
  },

  encryption: {
    masterKey: env.ENCRYPTION_MASTER_KEY,
    keyVersion: env.ENCRYPTION_KEY_VERSION,
  },

  smtp: {
    host: env.SMTP_HOST || undefined,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER || undefined,
    password: env.SMTP_PASSWORD || undefined,
    fromName: env.SMTP_FROM_NAME,
    fromEmail: env.SMTP_FROM_EMAIL,
    enabled: Boolean(env.SMTP_HOST && env.SMTP_USER),
  },

  imap: {
    host: env.IMAP_HOST || undefined,
    port: env.IMAP_PORT,
    secure: env.IMAP_SECURE,
    user: env.IMAP_USER || undefined,
    password: env.IMAP_PASSWORD || undefined,
    pollIntervalMs: env.IMAP_POLL_INTERVAL_MS,
    enabled: Boolean(env.IMAP_HOST && env.IMAP_USER),
  },

  telegram: {
    apiId: env.TELEGRAM_API_ID || undefined,
    apiHash: env.TELEGRAM_API_HASH || undefined,
    enabled: Boolean(env.TELEGRAM_API_ID && env.TELEGRAM_API_HASH),
  },

  push: {
    vapidPublicKey: env.VAPID_PUBLIC_KEY || undefined,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY || undefined,
    vapidSubject: env.VAPID_SUBJECT,
    enabled: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
  },

  ai: {
    provider: env.AI_PROVIDER,
    openai: {
      apiKey: env.OPENAI_API_KEY || undefined,
      model: env.OPENAI_MODEL,
      maxTokens: env.OPENAI_MAX_TOKENS,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY || undefined,
      model: env.ANTHROPIC_MODEL,
    },
    google: {
      apiKey: env.GOOGLE_AI_API_KEY || undefined,
      model: env.GOOGLE_AI_MODEL,
    },
    local: {
      baseUrl: env.LOCAL_LLM_BASE_URL,
      model: env.LOCAL_LLM_MODEL,
    },
    timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    maxRetries: env.AI_MAX_RETRIES,
    rateLimitPerMinute: env.AI_RATE_LIMIT_PER_MINUTE,
  },

  exchange: {
    requestTimeoutMs: env.EXCHANGE_REQUEST_TIMEOUT_MS,
    maxRetries: env.EXCHANGE_MAX_RETRIES,
    rateLimitBufferPct: env.EXCHANGE_RATE_LIMIT_BUFFER_PCT,
    wsReconnectBaseMs: env.EXCHANGE_WS_RECONNECT_BASE_MS,
    wsReconnectMaxMs: env.EXCHANGE_WS_RECONNECT_MAX_MS,
  },

  payments: {
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY || undefined,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY || undefined,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET || undefined,
      enabled: Boolean(env.STRIPE_SECRET_KEY),
    },
    paystack: {
      secretKey: env.PAYSTACK_SECRET_KEY || undefined,
      publishableKey: env.PAYSTACK_PUBLIC_KEY || undefined,
      webhookSecret: env.PAYSTACK_WEBHOOK_SECRET || undefined,
      enabled: Boolean(env.PAYSTACK_SECRET_KEY),
    },
    flutterwave: {
      secretKey: env.FLUTTERWAVE_SECRET_KEY || undefined,
      publishableKey: env.FLUTTERWAVE_PUBLIC_KEY || undefined,
      webhookSecret: env.FLUTTERWAVE_WEBHOOK_SECRET || undefined,
      enabled: Boolean(env.FLUTTERWAVE_SECRET_KEY),
    },
  },

  payouts: {
    stripeConnect: {
      clientId: env.STRIPE_CONNECT_CLIENT_ID || undefined,
      webhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET || undefined,
      enabled: Boolean(env.STRIPE_CONNECT_CLIENT_ID),
    },
  },

  storage: {
    driver: env.STORAGE_DRIVER,
    localPath: env.STORAGE_LOCAL_PATH,
    s3: {
      bucket: env.S3_BUCKET || undefined,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID || undefined,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || undefined,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    },
    upload: {
      maxFileSizeMb: env.UPLOAD_MAX_FILE_SIZE_MB,
      maxFileSizeBytes: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024,
      allowedMimeTypes: env.UPLOAD_ALLOWED_MIME_TYPES.split(',').map((s) => s.trim()),
    },
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    authMax: env.RATE_LIMIT_AUTH_MAX,
    aiMax: env.RATE_LIMIT_AI_MAX,
    exchangeMax: env.RATE_LIMIT_EXCHANGE_MAX,
  },

  websocket: {
    path: env.WS_PATH,
    pingIntervalMs: env.WS_PING_INTERVAL_MS,
    pingTimeoutMs: env.WS_PING_TIMEOUT_MS,
    maxConnectionsPerUser: env.WS_MAX_CONNECTIONS_PER_USER,
  },

  jobs: {
    queuePrefix: env.JOB_QUEUE_PREFIX,
    maxAttempts: env.JOB_MAX_ATTEMPTS,
    backoffBaseMs: env.JOB_BACKOFF_BASE_MS,
    backoffMaxMs: env.JOB_BACKOFF_MAX_MS,
    workerConcurrency: env.JOB_WORKER_CONCURRENCY,
    deadLetterTtlDays: env.JOB_DEAD_LETTER_TTL_DAYS,
  },

  observability: {
    logLevel: env.LOG_LEVEL,
    logFormat: env.LOG_FORMAT,
    logFileEnabled: env.LOG_FILE_ENABLED,
    logFilePath: env.LOG_FILE_PATH,
    metricsEnabled: env.METRICS_ENABLED,
    metricsPath: env.METRICS_PATH,
  },

  features: {
    marketplace: env.FEATURE_MARKETPLACE_ENABLED,
    automation: env.FEATURE_AUTOMATION_ENABLED,
    simulation: env.FEATURE_SIMULATION_ENABLED,
    referral: env.FEATURE_REFERRAL_ENABLED,
    community: env.FEATURE_COMMUNITY_ENABLED,
    developerApi: env.FEATURE_DEVELOPER_API_ENABLED,
  },

  security: {
    cspEnabled: env.CSP_ENABLED,
    hstsEnabled: env.HSTS_ENABLED,
    trustProxy: env.TRUST_PROXY,
    helmetEnabled: env.HELMET_ENABLED,
  },

  seed: {
    adminEmail: env.SEED_ADMIN_EMAIL,
    adminPassword: env.SEED_ADMIN_PASSWORD,
    demoData: env.SEED_DEMO_DATA,
  },
};

Object.freeze(config);

export default config;
export { config };

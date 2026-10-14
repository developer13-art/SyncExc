/**
 * SyncExc Server — Logger
 *
 * Pino-based structured logger with redaction. Development uses pretty output
 * if pino-pretty is available; otherwise falls back to JSON.
 */

import pino from 'pino';
import config from '../config.js';

const REDACT_PATHS = [
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'apiSecret',
  'apiKey',
  'apikey',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'mfaSecret',
  'recoveryCode',
  'recoveryCodes',
  'webhookSecret',
  'signingSecret',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'credentials.apiKey',
  'credentials.apiSecret',
  'credentials.passphrase',
  '*.apiKey',
  '*.apiSecret',
  '*.password',
  '*.secret',
  '*.token',
];

const baseOptions = {
  level: config.observability.logLevel,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
    remove: false,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'syncexc-server',
    env: config.env,
  },
};

let transport;
if (config.observability.logFormat === 'pretty' && config.isDevelopment) {
  try {
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname,service,env',
        singleLine: false,
      },
    };
  } catch {
    transport = undefined;
  }
}

const rootLogger = pino(
  transport ? { ...baseOptions, transport } : baseOptions
);

export function createLogger(bindings = {}) {
  return rootLogger.child(bindings);
}

export const logger = rootLogger;
export default rootLogger;
/**
 * SyncExc Server — Entry Point
 *
 * 1. Loads configuration (exits on failure).
 * 2. Initializes logger.
 * 3. Starts the health-only HTTP shell.
 * 4. Wires SIGTERM/SIGINT for graceful shutdown.
 */

import http from 'node:http';
import config from './config.js';
import { createLogger } from './lib/logger.js';
import { buildApp } from './app.js';
import { gracefulShutdown } from './lib/shutdown.js';

const logger = createLogger({ component: 'server' });

async function main() {
  logger.info(
    { env: config.env, version: process.env.npm_package_version || '1.0.0' },
    'Starting SyncExc server'
  );

  const services = {};
  const app = buildApp({ services });
  const server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.server.port, config.server.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  logger.info(
    { port: config.server.port, host: config.server.host, baseUrl: config.server.baseUrl },
    'HTTP server listening'
  );

  const shutdown = gracefulShutdown({ server, services, logger });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    shutdown('uncaughtException').finally(() => process.exit(1));
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
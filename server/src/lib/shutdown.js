/**
 * SyncExc Server — Graceful shutdown
 *
 * On SIGTERM/SIGINT:
 *   1. Stop accepting new HTTP connections.
 *   2. Stop the WebSocket server.
 *   3. Stop accepting new jobs; wait for in-flight jobs.
 *   4. Close the event bus.
 *   5. Close the DB pool.
 *   6. Close Redis.
 *   7. Exit.
 *
 * Idempotent: multiple signals do not run shutdown twice.
 */

const SHUTDOWN_TIMEOUT_MS = 30000;

export function gracefulShutdown({ server, services, logger }) {
  let shuttingDown = false;

  return async function shutdown(signal) {
    if (shuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress');
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, 'Shutdown initiated');

    const timeout = setTimeout(() => {
      logger.error('Shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      logger.info('Stopping HTTP server');
      await new Promise((resolve) => {
        server.close((err) => {
          if (err) logger.error({ err }, 'HTTP server close error');
          resolve();
        });
        // Force-destroy idle keep-alive sockets so `close` resolves promptly
        server.closeIdleConnections?.();
      });

      const shutdownSteps = [
        ['Stopping WebSocket server', services.realtime, 'shutdown'],
        ['Stopping source listeners', services.sourceListeners, 'shutdown'],
        ['Stopping exchange streams', services.exchangeStreams, 'shutdown'],
        ['Stopping job runner', services.jobs, 'shutdown'],
        ['Closing event bus', services.events, 'shutdown'],
        ['Closing database pool', services.db, 'close'],
        ['Closing Redis', services.redis, 'quit'],
      ];

      for (const [message, service, method] of shutdownSteps) {
        if (typeof service?.[method] !== 'function') continue;
        logger.info(message);
        try {
          await service[method]();
        } catch (err) {
          logger.error({ err }, `${message} error`);
        }
      }

      clearTimeout(timeout);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      clearTimeout(timeout);
      process.exit(1);
    }
  };
}

export default gracefulShutdown;
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

      logger.info('Stopping WebSocket server');
      try {
        await services.realtime.shutdown();
      } catch (err) {
        logger.error({ err }, 'WebSocket shutdown error');
      }

      logger.info('Stopping source listeners');
      try {
        await services.sourceListeners.shutdown();
      } catch (err) {
        logger.error({ err }, 'Source listener shutdown error');
      }

      logger.info('Stopping exchange streams');
      try {
        await services.exchangeStreams.shutdown();
      } catch (err) {
        logger.error({ err }, 'Exchange stream shutdown error');
      }

      logger.info('Stopping job runner');
      try {
        await services.jobs.shutdown();
      } catch (err) {
        logger.error({ err }, 'Job runner shutdown error');
      }

      logger.info('Closing event bus');
      try {
        await services.events.shutdown();
      } catch (err) {
        logger.error({ err }, 'Event bus shutdown error');
      }

      logger.info('Closing database pool');
      try {
        await services.db.close();
      } catch (err) {
        logger.error({ err }, 'Database shutdown error');
      }

      logger.info('Closing Redis');
      try {
        await services.redis.quit();
      } catch (err) {
        logger.error({ err }, 'Redis shutdown error');
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
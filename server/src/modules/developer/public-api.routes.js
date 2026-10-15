/**
 * SyncExc Server — Public API routes
 *
 * These are the actual API endpoints that developers consume. Every request
 * passes through the apiAuthorization service.
 *
 * Routes are mounted at `/api/public/v1` by the root router.
 */

import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { success } from '../../lib/response.js';
import { AppError } from '../../lib/errors.js';

export function createPublicApiRoutes({ apiAuthorization, services }) {
  const router = Router();

  /**
   * Middleware: authenticate the request.
   */
  async function authenticate(req, res, next) {
    const start = Date.now();
    try {
      const caller = await apiAuthorization.authenticate(req);
      req.apiCaller = caller;
      res.on('finish', () => {
        services.developer?.usage?.recordRequest({
          applicationId: caller.applicationId,
          credentialId: caller.credentialId || null,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - start,
          requestId: req.id,
          errorCode: res.locals.errorCode || null,
        });
      });
      next();
    } catch (err) {
      res.locals.errorCode = err.code || 'AUTH_ERROR';
      next(err);
    }
  }

  /**
   * Middleware factory: require a scope.
   */
  function requireScope(scope) {
    return function requireScopeMiddleware(req, _res, next) {
      try {
        apiAuthorization.requireScope(req.apiCaller, scope);
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  router.use(authenticate);

  /* ---------------------------------------------------------------------------
   * Profile / workspace
   * ------------------------------------------------------------------------ */
  router.get(
    '/me',
    requireScope('profile:read'),
    asyncHandler(async (req, res) => {
      const user = await services.db.query(
        `SELECT id, email, username, display_name, preferred_language, timezone FROM users WHERE id = $1`,
        [req.apiCaller.userId]
      );
      return success(res, user.rows[0] || null);
    })
  );

  router.get(
    '/workspaces',
    requireScope('workspace:read'),
    asyncHandler(async (req, res) => {
      const workspaces = await services.db.query(
        `
        SELECT w.id, w.name, w.type, w.status
        FROM workspaces w
        JOIN workspace_memberships m ON m.workspace_id = w.id
        WHERE m.user_id = $1 AND m.status = 'active'
        `,
        [req.apiCaller.userId]
      );
      return success(res, workspaces.rows);
    })
  );

  /* ---------------------------------------------------------------------------
   * Exchange accounts
   * ------------------------------------------------------------------------ */
  router.get(
    '/exchange-accounts',
    requireScope('exchange_accounts:read'),
    asyncHandler(async (req, res) => {
      const accounts = await services.db.query(
        `
        SELECT a.id, a.account_type, a.status, c.exchange_code, c.label
        FROM exchange_accounts a
        JOIN exchange_connections c ON c.id = a.connection_id
        WHERE c.workspace_id = $1 AND c.status = 'active'
        `,
        [req.apiCaller.workspaceId]
      );
      return success(res, accounts.rows);
    })
  );

  router.get(
    '/balances',
    requireScope('balances:read'),
    asyncHandler(async (req, res) => {
      const accountId = req.query.accountId;
      if (!accountId) throw new AppError('accountId is required', { code: 'VALIDATION_FAILED', status: 422, expose: true });

      // Verify account belongs to caller's workspace
      const account = await services.db.query(
        `
        SELECT a.* FROM exchange_accounts a
        JOIN exchange_connections c ON c.id = a.connection_id
        WHERE a.id = $1 AND c.workspace_id = $2
        `,
        [accountId, req.apiCaller.workspaceId]
      );
      if (account.rows.length === 0) {
        throw new AppError('Account not found', { code: 'RESOURCE_NOT_FOUND', status: 404, expose: true });
      }

      const balances = await services.connections.service.fetchBalances({ accountId });
      return success(res, balances);
    })
  );

  /* ---------------------------------------------------------------------------
   * Markets / instruments
   * ------------------------------------------------------------------------ */
  router.get(
    '/markets',
    requireScope('markets:read'),
    asyncHandler(async (req, res) => {
      const exchange = req.query.exchange;
      if (!exchange) throw new AppError('exchange is required', { code: 'VALIDATION_FAILED', status: 422, expose: true });
      const instruments = await services.db.query(
        `
        SELECT id, exchange_code, exchange_symbol, market_type, base_asset, quote_asset,
               tick_size, quantity_step, trading_status
        FROM exchange_instruments
        WHERE exchange_code = $1 AND trading_status = 'active'
        ORDER BY exchange_symbol
        LIMIT 500
        `,
        [exchange]
      );
      return success(res, instruments.rows);
    })
  );

  /* ---------------------------------------------------------------------------
   * Orders
   * ------------------------------------------------------------------------ */
  router.get(
    '/orders',
    requireScope('orders:read'),
    asyncHandler(async (req, res) => {
      const orders = await services.db.query(
        `
        SELECT id, connection_id, account_id, exchange_order_id, instrument, side, type,
               quantity, filled_quantity, price, status, created_at
        FROM trading_orders
        WHERE workspace_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        `,
        [req.apiCaller.workspaceId]
      );
      return success(res, orders.rows);
    })
  );

  router.get(
    '/orders/:orderId',
    requireScope('orders:read'),
    asyncHandler(async (req, res) => {
      const order = await services.db.query(
        `SELECT * FROM trading_orders WHERE id = $1 AND workspace_id = $2`,
        [req.params.orderId, req.apiCaller.workspaceId]
      );
      if (order.rows.length === 0) throw new AppError('Order not found', { code: 'RESOURCE_NOT_FOUND', status: 404, expose: true });
      return success(res, order.rows[0]);
    })
  );

  /* ---------------------------------------------------------------------------
   * Positions
   * ------------------------------------------------------------------------ */
  router.get(
    '/positions',
    requireScope('positions:read'),
    asyncHandler(async (req, res) => {
      const positions = await services.db.query(
        `SELECT * FROM trading_positions WHERE workspace_id = $1 AND quantity > 0`,
        [req.apiCaller.workspaceId]
      );
      return success(res, positions.rows);
    })
  );

  /* ---------------------------------------------------------------------------
   * Trades
   * ------------------------------------------------------------------------ */
  router.get(
    '/trades',
    requireScope('trades:read'),
    asyncHandler(async (req, res) => {
      const trades = await services.db.query(
        `
        SELECT id, order_id, instrument, side, quantity, price, fee_amount, fee_asset, executed_at
        FROM trading_fills
        WHERE workspace_id = $1
        ORDER BY executed_at DESC
        LIMIT 100
        `,
        [req.apiCaller.workspaceId]
      );
      return success(res, trades.rows);
    })
  );

  /* ---------------------------------------------------------------------------
   * Signals
   * ------------------------------------------------------------------------ */
  router.get(
    '/signals',
    requireScope('signals:read'),
    asyncHandler(async (req, res) => {
      const signals = await services.db.query(
        `
        SELECT id, instrument, direction, entry, stop_loss, leverage, status, created_at
        FROM trading_signal_candidates
        ORDER BY created_at DESC
        LIMIT 100
        `
      );
      return success(res, signals.rows);
    })
  );

  /* ---------------------------------------------------------------------------
   * Webhooks management
   * ------------------------------------------------------------------------ */
  router.get(
    '/webhooks',
    requireScope('webhooks:manage'),
    asyncHandler(async (req, res) => {
      const subs = await services.db.query(
        `
        SELECT id, destination_url, event_types, state, created_at
        FROM developer_webhook_subscriptions
        WHERE application_id = $1
        ORDER BY created_at DESC
        `,
        [req.apiCaller.applicationId]
      );
      return success(res, subs.rows);
    })
  );

  /* ---------------------------------------------------------------------------
   * Usage
   * ------------------------------------------------------------------------ */
  router.get(
    '/usage',
    asyncHandler(async (req, res) => {
      const summary = await services.db.query(
        `
        SELECT
          count(*)::int AS total_requests,
          count(*) FILTER (WHERE status < 400)::int AS successful_requests,
          count(*) FILTER (WHERE status >= 400)::int AS error_requests
        FROM developer_api_request_logs
        WHERE application_id = $1 AND created_at >= now() - interval '30 days'
        `,
        [req.apiCaller.applicationId]
      );
      return success(res, summary.rows[0]);
    })
  );

  return router;
}

export default createPublicApiRoutes;
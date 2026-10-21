/**
 * SyncExc Server — Terminal controller
 */

import { serializeOrder, serializeFill, serializePosition, serializeExecutionIntent } from '../../lib/serializers.js';
import { success, created, paginated } from '../../lib/response.js';

export function createTerminalController({ service, orderSubmissionService, portfolioService }) {
  return {
    async getMarketData(req, res) {
      const result = await service.getMarketData({
        exchangeCode: req.params.exchangeCode,
        symbol: req.params.symbol,
        marketType: req.query.marketType,
        timeframe: req.query.timeframe,
        limit: req.query.limit,
      });
      return success(res, result);
    },

    async overview(req, res) {
      const overview = await portfolioService.getWorkspaceOverview({
        workspaceId: req.workspace.id,
      });
      return success(res, overview);
    },

    async listOrders(req, res) {
      const { rows, nextCursor } = await service.listOrdersForScope({
        workspaceId: req.workspace.id,
        statuses: req.query.status ? [req.query.status] : null,
        accountId: req.query.accountId || null,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeOrder), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async listOpenOrders(req, res) {
      const { rows } = await service.listOpenOrders({
        workspaceId: req.workspace.id,
        accountId: req.query.accountId || null,
      });
      return success(res, rows.map(serializeOrder));
    },

    async getOrder(req, res) {
      const result = await service.getOrder(req.params.orderId, req.workspace.id);
      return success(res, {
        order: serializeOrder(result.order),
        events: result.events,
        fills: result.fills.map(serializeFill),
      });
    },

    async submitOrder(req, res) {
      const result = await orderSubmissionService.submit({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        ...req.body,
      });

      if (result.requiresConfirmation) {
        return created(res, {
          requiresConfirmation: true,
          executionRequestId: result.executionRequest.id,
          riskDecision: result.riskDecision,
        });
      }

      return created(res, {
        order: result.order ? serializeOrder(result.order) : null,
        executionRequest: result.executionRequest,
        riskDecision: result.riskDecision,
        ambiguous: result.ambiguous || false,
      });
    },

    async confirmOrder(req, res) {
      const result = await orderSubmissionService.confirm({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        executionRequestId: req.params.executionRequestId,
      });
      return success(res, {
        order: result.order ? serializeOrder(result.order) : null,
        executionRequest: result.executionRequest,
      });
    },

    async cancelConfirmation(req, res) {
      const result = await orderSubmissionService.cancelConfirmation({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        executionRequestId: req.params.executionRequestId,
      });
      return success(res, result);
    },

    async listPositions(req, res) {
      const positions = await service.listPositions({
        workspaceId: req.workspace.id,
        accountId: req.query.accountId || null,
        instrument: req.query.instrument || null,
      });
      return success(res, positions.map(serializePosition));
    },

    async syncPositions(req, res) {
      const positions = await service.syncAccountState({
        workspaceId: req.workspace.id,
        accountId: req.body.accountId,
      });
      return success(res, positions.map(serializePosition));
    },

    async listTrades(req, res) {
      const { rows, nextCursor } = await service.listTradesForScope({
        workspaceId: req.workspace.id,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
        accountId: req.query.accountId || null,
        instrument: req.query.instrument || null,
      });
      return paginated(res, rows.map(serializeFill), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async getExecutionRequest(req, res) {
      const result = await service.getExecutionRequest(
        req.params.executionRequestId,
        req.workspace.id
      );
      return success(res, {
        request: result.request,
        attempts: result.attempts,
      });
    },

    async getPreferences(req, res) {
      const prefs = await service.getPreferences({ userId: req.auth.userId });
      return success(res, prefs || {});
    },

    async updatePreferences(req, res) {
      const prefs = await service.updatePreferences({
        userId: req.auth.userId,
        updates: req.body,
      });
      return success(res, prefs);
    },

    async listSavedViews(req, res) {
      const views = await service.listSavedViews({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
      });
      return success(res, views);
    },

    async createSavedView(req, res) {
      const view = await service.createSavedView({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        name: req.body.name,
        viewType: req.body.viewType,
        config: req.body.config,
      });
      return created(res, view);
    },

    async deleteSavedView(req, res) {
      const result = await service.deleteSavedView({
        userId: req.auth.userId,
        viewId: req.params.viewId,
      });
      return success(res, result);
    },
  };
}

export default createTerminalController;
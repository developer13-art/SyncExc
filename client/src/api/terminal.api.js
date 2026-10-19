import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const terminalApi = {
  getOverview: (workspaceId) => api.get(endpoints.terminal.overview(workspaceId)),

  listAccounts: (workspaceId, params) =>
    api.get(endpoints.terminal.accounts(workspaceId), { params }),

  listMarkets: (workspaceId, params = {}) => {
    const { exchangeCode, ...query } = params;
    if (!exchangeCode) {
      throw new Error('An exchange code is required to list instruments.');
    }
    return api.get(endpoints.terminal.markets(workspaceId, exchangeCode), { params: query });
  },

  getMarketData: (workspaceId, { exchangeCode, symbol, ...params }) => {
    if (!exchangeCode || !symbol) {
      throw new Error('An exchange and instrument are required to load market data.');
    }
    return api.get(endpoints.terminal.marketData(workspaceId, exchangeCode, symbol), { params });
  },

  listOrders: (workspaceId, params) =>
    api.getPaged(endpoints.terminal.orders(workspaceId), { params }),

  getOrder: (workspaceId, orderId) =>
    api.get(endpoints.terminal.order(workspaceId, orderId)),

  submitOrder: (workspaceId, payload) =>
    api.post(endpoints.terminal.orders(workspaceId), payload),

  confirmExecution: (workspaceId, executionRequestId) =>
    api.post(endpoints.terminal.confirmExecution(workspaceId, executionRequestId)),

  cancelExecutionConfirmation: (workspaceId, executionRequestId) =>
    api.post(endpoints.terminal.cancelExecutionConfirmation(workspaceId, executionRequestId)),

  cancelOrder: (workspaceId, orderId, payload) =>
    api.post(endpoints.terminal.cancelOrder(workspaceId, orderId), payload),

  listPositions: (workspaceId, params) =>
    api.get(endpoints.terminal.positions(workspaceId), { params }),

  listBalances: (workspaceId, params) =>
    api.get(endpoints.terminal.balances(workspaceId), { params }),

  listTrades: (workspaceId, params) =>
    api.getPaged(endpoints.terminal.trades(workspaceId), { params }),

  listExecutions: (workspaceId, params) =>
    api.getPaged(endpoints.terminal.executions(workspaceId), { params }),

  requestReconciliation: (workspaceId, recordId) =>
    api.post(endpoints.terminal.reconciliation(workspaceId, recordId)),

  listNotifications: (workspaceId, params) =>
    api.get(endpoints.terminal.notifications(workspaceId), { params }),

  requestExport: (workspaceId, payload) =>
    api.post(endpoints.terminal.exports(workspaceId), payload),

  getExportStatus: (workspaceId, exportId) =>
    api.get(endpoints.terminal.exportStatus(workspaceId, exportId)),

  getPreferences: (workspaceId) => api.get(endpoints.terminal.preferences(workspaceId)),

  updatePreferences: (workspaceId, payload) =>
    api.patch(endpoints.terminal.preferences(workspaceId), payload),
};
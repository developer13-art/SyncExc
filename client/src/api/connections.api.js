import api from './client.js';
import { apiConfig } from '../config/api.config.js';

const { endpoints } = apiConfig;

export const connectionsApi = {
  list: (params) => api.getPaged(endpoints.connections.list, { params }),

  create: (payload) => api.post(endpoints.connections.create, payload),

  getById: (connectionId) => api.get(endpoints.connections.detail(connectionId)),

  update: (connectionId, payload) =>
    api.patch(endpoints.connections.detail(connectionId), payload),

  test: (connectionId) => api.post(endpoints.connections.test(connectionId)),

  validate: async (connectionId) => {
    const result = await api.post(endpoints.connections.validate(connectionId));
    return {
      ...result,
      permissions: result.permissions ?? {
        'account.read':
          typeof result.canRead === 'boolean'
            ? result.canRead
              ? 'verified'
              : 'missing_permission'
            : 'unknown',
        trading:
          typeof result.canTrade === 'boolean'
            ? result.canTrade
              ? 'verified'
              : 'missing_permission'
            : 'unknown',
      },
    };
  },

  rotateCredentials: (connectionId, payload) =>
    api.post(endpoints.connections.rotate(connectionId), payload),

  sync: (connectionId) => api.post(endpoints.connections.sync(connectionId)),

  listAccounts: (connectionId) => api.get(endpoints.connections.accounts(connectionId)),

  listBalances: (connectionId) => api.get(endpoints.connections.balances(connectionId)),

  getHealth: (connectionId) => api.get(endpoints.connections.health(connectionId)),

  getPermissions: (connectionId) => api.get(endpoints.connections.permissions(connectionId)),

  suspend: (connectionId, payload) =>
    api.post(endpoints.connections.suspend(connectionId), payload),

  disconnect: (connectionId, payload) =>
    api.post(endpoints.connections.disconnect(connectionId), payload),

  remove: (connectionId) => api.delete(endpoints.connections.detail(connectionId)),

  listExchangeInstruments: (params) => api.get(endpoints.connections.instruments, { params }),

  getExchangeCapabilities: (exchangeId) =>
    api.get(endpoints.connections.capabilities(exchangeId)),

  getConnectionRequirements: (exchangeId) =>
    api.get(endpoints.connections.connectionRequirements(exchangeId)),

  listExchangeRegistry: () => api.get(endpoints.connections.exchangeRegistry),
};
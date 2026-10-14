/**
 * SyncExc Server — Connections controller
 */

import { success, created, noContent } from '../../lib/response.js';
import { serializeConnection, serializeAccount, serializeInstrument } from '../../lib/serializers.js';

export function createConnectionsController({ service }) {
  return {
    async listExchanges(req, res) {
      const { db } = req.services;
      const { rows } = await db.query(
        `SELECT * FROM exchange_registry ORDER BY display_name ASC`
      );
      return success(res, rows.map((r) => ({
        code: r.exchange_code,
        displayName: r.display_name,
        status: r.integration_status,
        regions: r.supported_regions,
      })));
    },

    async listConnections(req, res) {
      const connections = await service.listConnections({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
      });
      return success(res, connections.map((c) => ({
        ...serializeConnection(c),
        isShared: c.is_shared || false,
      })));
    },

    async getConnection(req, res) {
      const connection = await service.getConnection(req.params.connectionId);
      if (!connection) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Connection not found' } });
      return success(res, serializeConnection(connection));
    },

    async createConnection(req, res) {
      const connection = await service.createConnection({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        exchange: req.body.exchange,
        environment: req.body.environment,
        label: req.body.label,
        credentials: req.body.credentials,
      });
      return created(res, serializeConnection(connection));
    },

    async testConnection(req, res) {
      const result = await service.testConnection({
        userId: req.auth.userId,
        connectionId: req.params.connectionId,
      });
      return success(res, result);
    },

    async rotateCredentials(req, res) {
      const result = await service.rotateCredentials({
        userId: req.auth.userId,
        connectionId: req.params.connectionId,
        credentials: req.body.credentials,
        reason: req.body.reason,
      });
      return success(res, { rotated: true });
    },

    async suspendConnection(req, res) {
      const result = await service.suspendConnection({
        userId: req.auth.userId,
        connectionId: req.params.connectionId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async disconnectConnection(req, res) {
      const result = await service.disconnectConnection({
        userId: req.auth.userId,
        connectionId: req.params.connectionId,
      });
      return success(res, result);
    },

    async listAccounts(req, res) {
      const accounts = await service.listAccounts({
        connectionId: req.params.connectionId,
      });
      return success(res, accounts.map(serializeAccount));
    },

    async fetchBalances(req, res) {
      const balances = await service.fetchBalances({
        accountId: req.params.accountId,
      });
      return success(res, balances);
    },

    async listInstruments(req, res) {
      const instruments = await service.listInstruments({
        exchangeCode: req.query.exchange,
        marketType: req.query.marketType,
      });
      return success(res, instruments.map(serializeInstrument));
    },

    async getHealth(req, res) {
      const health = await service.getHealth({
        connectionId: req.params.connectionId,
      });
      return success(res, health);
    },
  };
}

export default createConnectionsController;
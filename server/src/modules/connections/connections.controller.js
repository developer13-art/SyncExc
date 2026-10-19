/**
 * SyncExc Server — Connections controller
 */

import { success, created, noContent } from '../../lib/response.js';
import { serializeConnection, serializeAccount, serializeInstrument } from '../../lib/serializers.js';
import { EXCHANGE_ENVIRONMENTS } from '@syncexc/shared';

function serializePermissionMap(permissions) {
  return Object.fromEntries(
    permissions.map((permission) => [
      permission.permission_key,
      permission.verification,
    ]),
  );
}

export function createConnectionsController({ service }) {
  return {
    async getConnectionRequirements(req, res) {
      const exchange = String(req.params.exchangeCode).toLowerCase();
      const environmentLabels = {
        live: 'Real account',
        demo: 'Demo account',
        testnet: 'Testnet',
      };
      const requirementsByExchange = {
        binance: [
          { name: 'apiKey', label: 'API Key', type: 'text', required: true },
          { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
        ],
        bybit: [
          { name: 'apiKey', label: 'API Key', type: 'text', required: true },
          { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
        ],
        bitget: [
          { name: 'apiKey', label: 'API Key', type: 'text', required: true },
          { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
          {
            name: 'passphrase',
            label: 'API Key Passphrase',
            type: 'password',
            required: true,
            hint: 'Enter the passphrase you set when creating this API key on Bitget.',
          },
        ],
        okx: [
          { name: 'apiKey', label: 'API Key', type: 'text', required: true },
          { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
          {
            name: 'passphrase',
            label: 'API Key Passphrase',
            type: 'password',
            required: true,
            hint: 'Enter the passphrase you set when creating this API key on OKX.',
          },
        ],
      };
      return success(res, {
        requirements: requirementsByExchange[exchange] ?? [],
        environments: (EXCHANGE_ENVIRONMENTS[exchange] ?? []).map((value) => ({
          value,
          label: environmentLabels[value],
        })),
      });
    },

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
      const connection = await service.requireConnectionAccess({
        connectionId: req.params.connectionId,
        workspaceId: req.workspace.id,
      });
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
      const permissions = await service.listPermissions({
        connectionId: connection.id,
        workspaceId: req.workspace.id,
      });
      return created(res, {
        ...serializeConnection(connection),
        permissions: serializePermissionMap(permissions),
      });
    },

    async testConnection(req, res) {
      const result = await service.testConnection({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        connectionId: req.params.connectionId,
      });
      return success(res, result);
    },

    async syncConnection(req, res) {
      const result = await service.syncConnection({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        connectionId: req.params.connectionId,
      });
      return success(res, result);
    },

    async rotateCredentials(req, res) {
      await service.rotateCredentials({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        connectionId: req.params.connectionId,
        credentials: req.body.credentials,
        reason: req.body.reason,
      });
      const permissions = await service.listPermissions({
        connectionId: req.params.connectionId,
        workspaceId: req.workspace.id,
      });
      return success(res, {
        rotated: true,
        permissions: serializePermissionMap(permissions),
      });
    },

    async suspendConnection(req, res) {
      const result = await service.suspendConnection({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        connectionId: req.params.connectionId,
        reason: req.body.reason,
      });
      return success(res, result);
    },

    async disconnectConnection(req, res) {
      const result = await service.disconnectConnection({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        connectionId: req.params.connectionId,
      });
      return success(res, result);
    },

    async listAccounts(req, res) {
      const accounts = await service.listAccounts({
        connectionId: req.params.connectionId,
        workspaceId: req.workspace.id,
      });
      return success(res, accounts.map(serializeAccount));
    },

    async fetchBalances(req, res) {
      const balances = await service.fetchBalances({
        accountId: req.params.accountId,
        workspaceId: req.workspace.id,
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
        workspaceId: req.workspace.id,
      });
      return success(res, health);
    },

    async listPermissions(req, res) {
      const permissions = await service.listPermissions({
        connectionId: req.params.connectionId,
        workspaceId: req.workspace.id,
      });
      return success(res, permissions.map((permission) => ({
        key: permission.permission_key,
        verification: permission.verification,
        lastCheckedAt: permission.last_checked_at,
      })));
    },
  };
}

export default createConnectionsController;
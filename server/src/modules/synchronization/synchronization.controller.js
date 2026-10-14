/**
 * SyncExc Server — Synchronization controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeSyncGroup, serializeSyncOperation } from '../../lib/serializers.js';

export function createSyncController({ service, reconciliation }) {
  return {
    async listGroups(req, res) {
      const groups = await service.listGroups({ workspaceId: req.workspace.id });
      return success(res, groups.map(serializeSyncGroup));
    },

    async createGroup(req, res) {
      const group = await service.createGroup({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        name: req.body.name,
        sourceConnectionId: req.body.sourceConnectionId,
        sourceAccountId: req.body.sourceAccountId,
        marketTypes: req.body.marketTypes,
        enabledEventTypes: req.body.enabledEventTypes,
        mirroringMode: req.body.mirroringMode,
        executionMode: req.body.executionMode,
      });
      return created(res, serializeSyncGroup(group));
    },

    async getGroup(req, res) {
      const result = await service.getGroup({
        groupId: req.params.groupId,
        workspaceId: req.workspace.id,
      });
      return success(res, {
        group: serializeSyncGroup(result.group),
        destinations: result.destinations,
      });
    },

    async addDestination(req, res) {
      const dest = await service.addDestination({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        groupId: req.params.groupId,
        connectionId: req.body.connectionId,
        accountId: req.body.accountId,
        sizingPolicyType: req.body.sizingPolicyType,
        sizingPolicyConfig: req.body.sizingPolicyConfig,
      });
      return created(res, dest);
    },

    async pauseGroup(req, res) {
      const group = await service.pauseGroup({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        groupId: req.params.groupId,
        reason: req.body.reason,
      });
      return success(res, serializeSyncGroup(group));
    },

    async resumeGroup(req, res) {
      const group = await service.resumeGroup({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        groupId: req.params.groupId,
      });
      return success(res, serializeSyncGroup(group));
    },

    async listOperations(req, res) {
      const { rows, nextCursor } = await service.listOperations({
        workspaceId: req.workspace.id,
        groupId: req.query.groupId || null,
        status: req.query.status || null,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeSyncOperation), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async getOperation(req, res) {
      const result = await service.getOperation({
        operationId: req.params.operationId,
        workspaceId: req.workspace.id,
      });
      return success(res, {
        operation: serializeSyncOperation(result.operation, result.destinations),
        group: serializeSyncGroup(result.group),
      });
    },

    async reconcileOperation(req, res) {
      await reconciliation.reconcileOperation(req.params.operationId);
      const operation = await service.getOperation({
        operationId: req.params.operationId,
        workspaceId: req.workspace.id,
      });
      return success(res, serializeSyncOperation(operation.operation, operation.destinations));
    },

    async getStats(req, res) {
      const stats = await service.getStats({
        workspaceId: req.workspace.id,
        groupId: req.query.groupId || null,
      });
      return success(res, stats);
    },
  };
}

export default createSyncController;
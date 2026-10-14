/**
 * SyncExc Server — Synchronization service (read-side + group management)
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';
import { SYNC_STATUS, SIZING_POLICY_TYPE } from '@syncexc/shared';

export function createSyncService({ db, queries, events, audit, logger }) {
  /* ===========================================================================
   * GROUPS
   * ======================================================================== */

  async function createGroup({
    userId,
    workspaceId,
    name,
    sourceConnectionId,
    sourceAccountId,
    marketTypes,
    enabledEventTypes,
    mirroringMode,
    executionMode,
  }) {
    // Basic validation
    if (!marketTypes || marketTypes.length === 0) {
      throw new ValidationError('At least one market type is required');
    }
    if (!enabledEventTypes || enabledEventTypes.length === 0) {
      throw new ValidationError('At least one event type is required');
    }

    return db.tx(async (tx) => {
      const group = await queries.insertGroup(tx, {
        workspaceId,
        name,
        sourceConnectionId,
        sourceAccountId,
        marketTypes,
        enabledEventTypes,
        mirroringMode,
        executionMode,
        createdBy: userId,
      });

      // Snapshot the initial version
      await queries.insertGroupVersion(tx, {
        groupId: group.id,
        version: 1,
        snapshot: group,
      });

      // Create event subscriptions
      for (const eventType of enabledEventTypes) {
        await queries.upsertEventSubscription(tx, {
          groupId: group.id,
          eventType,
        });
      }

      await events.publish(
        tx,
        'sync.group_created',
        { groupId: group.id, workspaceId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'sync_group',
          resourceId: group.id,
        }
      );

      return group;
    });
  }

  async function getGroup({ groupId, workspaceId }) {
    const group = await queries.findGroupById(groupId);
    if (!group || group.workspace_id !== workspaceId) throw new NotFoundError('Sync group');
    const destinations = await queries.listDestinationsForGroup(groupId);
    return { group, destinations };
  }

  async function listGroups({ workspaceId }) {
    return queries.listGroupsForWorkspace(workspaceId);
  }

  async function addDestination({
    userId,
    workspaceId,
    groupId,
    connectionId,
    accountId,
    sizingPolicyType,
    sizingPolicyConfig,
  }) {
    const group = await queries.findGroupById(groupId);
    if (!group || group.workspace_id !== workspaceId) throw new NotFoundError('Sync group');
    if (group.status === 'archived') {
      throw new ConflictError('Group is archived', 'GROUP_ARCHIVED');
    }

    // Validate sizing policy type
    if (!Object.values(SIZING_POLICY_TYPE).includes(sizingPolicyType)) {
      throw new ValidationError(`Invalid sizing policy type: ${sizingPolicyType}`);
    }

    return db.tx(async (tx) => {
      const sizingPolicy = await queries.insertSizingPolicy(tx, {
        groupId,
        name: `${sizingPolicyType} policy`,
        policyType: sizingPolicyType,
        config: sizingPolicyConfig,
      });

      const destination = await queries.insertDestination(tx, {
        groupId,
        connectionId,
        accountId,
        sizingPolicyId: sizingPolicy.id,
      });

      await events.publish(
        tx,
        'sync.destination_added',
        { groupId, destinationId: destination.id, accountId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'sync_destination',
          resourceId: destination.id,
        }
      );

      return destination;
    });
  }

  async function pauseGroup({ userId, workspaceId, groupId, reason }) {
    const group = await queries.findGroupById(groupId);
    if (!group || group.workspace_id !== workspaceId) throw new NotFoundError('Sync group');

    return db.tx(async (tx) => {
      const updated = await queries.updateGroupStatus(groupId, 'paused');

      await queries.insertPauseEvent(tx, {
        groupId,
        scope: 'group',
        action: 'pause',
        reason,
        actorId: userId,
      });

      await events.publish(
        tx,
        'sync.group_paused',
        { groupId, reason },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'sync_group',
          resourceId: groupId,
        }
      );

      return updated;
    });
  }

  async function resumeGroup({ userId, workspaceId, groupId }) {
    const group = await queries.findGroupById(groupId);
    if (!group || group.workspace_id !== workspaceId) throw new NotFoundError('Sync group');
    if (group.status !== 'paused') throw new ConflictError('Group is not paused', 'NOT_PAUSED');

    return db.tx(async (tx) => {
      const updated = await queries.updateGroupStatus(groupId, 'active');

      await queries.insertPauseEvent(tx, {
        groupId,
        scope: 'group',
        action: 'resume',
        actorId: userId,
      });

      await events.publish(
        tx,
        'sync.group_resumed',
        { groupId },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'sync_group',
          resourceId: groupId,
        }
      );

      return updated;
    });
  }

  /* ===========================================================================
   * OPERATIONS (read-side)
   * ======================================================================== */

  async function getOperation({ operationId, workspaceId }) {
    const operation = await queries.findOperationById(operationId);
    if (!operation) throw new NotFoundError('Operation');

    const group = await queries.findGroupById(operation.group_id);
    if (!group || group.workspace_id !== workspaceId) throw new NotFoundError('Operation');

    const destinations = await queries.listDestinationOperations(operationId);
    return { operation, destinations, group };
  }

  async function listOperations({ workspaceId, groupId, status, limit, cursor }) {
    return queries.listOperationsForWorkspace(workspaceId, { groupId, status, limit, cursor });
  }

  /* ===========================================================================
   * STATISTICS
   * ======================================================================== */

  async function getStats({ workspaceId, groupId = null }) {
    const params = [workspaceId];
    let groupFilter = '';
    if (groupId) {
      params.push(groupId);
      groupFilter = `AND g.id = $${params.length}`;
    }
    const result = await db.query(
      `
      SELECT 
        o.status,
        count(*)::int AS count
      FROM sync_operations o
      JOIN sync_groups g ON g.id = o.group_id
      WHERE g.workspace_id = $1 ${groupFilter}
        AND o.created_at >= now() - interval '24 hours'
      GROUP BY o.status
      `,
      params
    );
    return result.rows.reduce((acc, r) => {
      acc[r.status] = r.count;
      return acc;
    }, {});
  }

  return {
    createGroup,
    getGroup,
    listGroups,
    addDestination,
    pauseGroup,
    resumeGroup,
    getOperation,
    listOperations,
    getStats,
  };
}

export default createSyncService;
/**
 * SyncExc Server — Group service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

export function createGroupService({ db, queries, events, logger }) {
  async function createGroup({ userId, workspaceId, name, slug, description, type, topics }) {
    const existing = await queries.findGroupBySlug(slug);
    if (existing) throw new ConflictError('Slug is already taken', 'SLUG_TAKEN');

    if (!['public', 'private', 'approval_based', 'organization'].includes(type)) {
      throw new ConflictError(`Invalid group type: ${type}`);
    }

    return db.tx(async (tx) => {
      const group = await queries.insertGroup(tx, {
        ownerId: userId,
        workspaceId,
        name,
        slug,
        description,
        type,
        visibility: type === 'private' ? 'group_members' : 'public',
      });

      // Owner becomes first member
      await queries.insertGroupMembership(tx, {
        groupId: group.id,
        userId,
        state: 'active',
      });

      await queries.incrementGroupMemberCount(group.id, 1);

      await events.publish(
        tx,
        'community.group_created',
        { groupId: group.id, name, slug, type },
        {
          actorId: userId,
          resourceType: 'community_group',
          resourceId: group.id,
        }
      );

      return group;
    });
  }

  async function getGroup({ groupId, viewerId }) {
    const group = await queries.findGroupById(groupId);
    if (!group) throw new NotFoundError('Group');

    if (group.type === 'private' && viewerId) {
      const membership = await queries.findGroupMembership(groupId, viewerId);
      if (!membership || membership.state !== 'active') {
        throw new AuthorizationError('Not a member of this group');
      }
    }

    return group;
  }

  async function listPublicGroups({ limit, cursor }) {
    return queries.listPublicGroups({ limit, cursor });
  }

  async function joinGroup({ userId, groupId }) {
    const group = await queries.findGroupById(groupId);
    if (!group) throw new NotFoundError('Group');

    if (group.type === 'approval_based') {
      return db.tx(async (tx) => {
        return queries.insertGroupMembership(tx, {
          groupId,
          userId,
          state: 'requested',
        });
      });
    }

    return db.tx(async (tx) => {
      const membership = await queries.insertGroupMembership(tx, {
        groupId,
        userId,
        state: 'active',
      });

      await queries.incrementGroupMemberCount(groupId, 1);

      await events.publish(
        tx,
        'community.member_joined_group',
        { groupId, userId },
        {
          actorId: userId,
          resourceType: 'community_group',
          resourceId: groupId,
        }
      );

      return membership;
    });
  }

  async function leaveGroup({ userId, groupId }) {
    const membership = await queries.findGroupMembership(groupId, userId);
    if (!membership || membership.state !== 'active') {
      throw new NotFoundError('Membership');
    }

    return db.tx(async (tx) => {
      await queries.insertGroupMembership(tx, {
        groupId,
        userId,
        state: 'left',
      });

      await queries.incrementGroupMemberCount(groupId, -1);
      return { ok: true };
    });
  }

  async function listMembers({ groupId, viewerId, limit }) {
    const group = await queries.findGroupById(groupId);
    if (!group) throw new NotFoundError('Group');

    // Private groups: only members can list other members
    if (group.type === 'private' && viewerId) {
      const membership = await queries.findGroupMembership(groupId, viewerId);
      if (!membership || membership.state !== 'active') {
        throw new AuthorizationError('Not permitted');
      }
    }

    return queries.listGroupMembers(groupId, { limit });
  }

  return {
    createGroup,
    getGroup,
    listPublicGroups,
    joinGroup,
    leaveGroup,
    listMembers,
  };
}

export default createGroupService;
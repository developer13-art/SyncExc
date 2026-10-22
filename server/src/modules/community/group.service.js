/**
 * SyncExc Server — Group service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

export function createGroupService({ db, queries, events, profileImages, logger }) {
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
        topics,
        visibility: type === 'private' ? 'group_members' : 'public',
      });

      // Owner becomes first member
      await queries.insertGroupMembership(tx, {
        groupId: group.id,
        userId,
        state: 'active',
      });

      await queries.incrementGroupMemberCount(group.id, 1, tx);

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

    const membership = viewerId
      ? await queries.findGroupMembership(groupId, viewerId)
      : null;
    const isActiveMember = membership?.state === 'active';
    const role = viewerId ? await queries.findGroupRole(groupId, viewerId) : null;

    if (['private', 'organization'].includes(group.type) && !isActiveMember) {
      if (!viewerId) throw new AuthorizationError('Not a member of this group');
      if (group.type !== 'organization' || group.owner_id !== viewerId) {
        throw new AuthorizationError('Not a member of this group');
      }
    }

    return {
      ...group,
      viewer_is_member: isActiveMember,
      viewer_is_requested: membership?.state === 'requested',
      viewer_is_moderator:
        group.owner_id === viewerId || ['administrator', 'moderator'].includes(role),
      viewer_role: group.owner_id === viewerId ? 'owner' : role || 'member',
    };
  }

  async function listGroupPosts({ groupId, viewerId, limit, cursor }) {
    const group = await queries.findGroupById(groupId);
    if (!group) throw new NotFoundError('Group');
    const membership = viewerId
      ? await queries.findGroupMembership(groupId, viewerId)
      : null;
    const isActiveMember = membership?.state === 'active';
    if (group.type !== 'public' && !isActiveMember) {
      throw new AuthorizationError('Not a member of this group');
    }

    return queries.listGroupPosts({
      groupId,
      viewerId,
      allowPublic: group.type === 'public',
      limit,
      cursor,
    });
  }

  async function listMembers({ groupId, viewerId, limit }) {
    const group = await queries.findGroupById(groupId);
    if (!group) throw new NotFoundError('Group');

    if (group.type !== 'public') {
      const membership = viewerId
        ? await queries.findGroupMembership(groupId, viewerId)
        : null;
      if (membership?.state !== 'active') {
        throw new AuthorizationError('Not permitted');
      }
    }

    return queries.listGroupMembers(groupId, { limit, viewerId });
  }

  async function listPublicGroups({ userId, filter, query, limit, cursor }) {
    return queries.listPublicGroups({ userId, filter, query, limit, cursor });
  }

  async function joinGroup({ userId, groupId }) {
    const group = await queries.findGroupById(groupId);
    if (!group) throw new NotFoundError('Group');

    if (group.type === 'private' || group.type === 'organization') {
      throw new AuthorizationError('This group requires an invitation');
    }

    const existing = await queries.findGroupMembership(groupId, userId);
    if (existing?.state === 'active' || existing?.state === 'requested') return existing;
    if (existing?.state === 'banned') {
      throw new AuthorizationError('You are not allowed to join this group');
    }

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

      await queries.incrementGroupMemberCount(groupId, 1, tx);

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
    const group = await queries.findGroupById(groupId);
    if (!group) throw new NotFoundError('Group');
    if (group.owner_id === userId) {
      throw new ConflictError('The group owner cannot leave without transferring ownership');
    }
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

      await queries.incrementGroupMemberCount(groupId, -1, tx);
      return { ok: true };
    });
  }

  async function requireModerator(groupId, userId) {
    const group = await queries.findGroupById(groupId);
    if (!group) throw new NotFoundError('Group');
    const role = group.owner_id === userId
      ? 'owner'
      : await queries.findGroupRole(groupId, userId);
    if (!['owner', 'administrator', 'moderator'].includes(role)) {
      throw new AuthorizationError('Group moderator permission required');
    }
    return { group, role };
  }

  async function updateGroup({ groupId, userId, updates }) {
    const { role } = await requireModerator(groupId, userId);
    if (role === 'moderator') {
      throw new AuthorizationError('Only owners and administrators can update group settings');
    }
    const normalizedUpdates = { ...updates };
    if (updates.type) {
      normalizedUpdates.visibility = ['private', 'approval_based', 'organization'].includes(updates.type)
        ? 'group_members'
        : 'public';
    }
    return queries.updateGroup(groupId, normalizedUpdates);
  }

  async function updateGroupImage({ groupId, userId, imageType, file }) {
    if (!['avatar', 'cover'].includes(imageType)) {
      throw new ConflictError('Unsupported group image type');
    }
    const { group } = await requireModerator(groupId, userId);
    const uploaded = await profileImages.upload(file);
    const imageField = imageType === 'avatar' ? 'avatarUrl' : 'coverImageUrl';
    const previousUrl = imageType === 'avatar' ? group.avatar_url : group.cover_image_url;

    let updated;
    try {
      updated = await queries.updateGroup(groupId, { [imageField]: uploaded.url });
    } catch (error) {
      await profileImages.remove(uploaded.url);
      throw error;
    }

    if (previousUrl && previousUrl !== uploaded.url) {
      try {
        await profileImages.remove(previousUrl);
      } catch (error) {
        logger.warn({ err: error, groupId, imageType }, 'Could not remove previous group image');
      }
    }
    return updated;
  }

  async function listJoinRequests({ groupId, userId, limit }) {
    await requireModerator(groupId, userId);
    return queries.listGroupRequests(groupId, { limit });
  }

  async function resolveJoinRequest({ groupId, userId, targetUserId, approved }) {
    await requireModerator(groupId, userId);
    const membership = await db.tx(async (tx) => {
      const result = await queries.resolveGroupRequest(tx, {
        groupId,
        userId: targetUserId,
        state: approved ? 'active' : 'removed',
      });
      if (result && approved) await queries.incrementGroupMemberCount(groupId, 1, tx);
      return result;
    });
    if (!membership) throw new NotFoundError('Join request');
    return membership;
  }

  async function setMemberRole({ groupId, userId, targetUserId, role }) {
    const { group } = await requireModerator(groupId, userId);
    const actorRole = group.owner_id === userId
      ? 'owner'
      : await queries.findGroupRole(groupId, userId);
    if (actorRole !== 'owner' && actorRole !== 'administrator') {
      throw new AuthorizationError('Only owners and administrators can assign roles');
    }
    if (targetUserId === group.owner_id) {
      throw new ConflictError('The group owner role cannot be changed');
    }
    const membership = await queries.findGroupMembership(groupId, targetUserId);
    if (membership?.state !== 'active') throw new NotFoundError('Active group member');
    return db.tx((tx) => queries.setGroupRole(tx, { groupId, userId: targetUserId, role }));
  }

  async function removeMember({ groupId, userId, targetUserId }) {
    const { group } = await requireModerator(groupId, userId);
    if (targetUserId === group.owner_id) {
      throw new ConflictError('The group owner cannot be removed');
    }
    const actorRole = group.owner_id === userId
      ? 'owner'
      : await queries.findGroupRole(groupId, userId);
    const targetRole = await queries.findGroupRole(groupId, targetUserId);
    if (
      ['moderator', 'administrator'].includes(targetRole) &&
      actorRole !== 'owner'
    ) {
      throw new AuthorizationError('Only the group owner can remove administrators or moderators');
    }
    const membership = await db.tx(async (tx) => {
      const result = await queries.changeGroupMemberState(tx, {
        groupId,
        userId: targetUserId,
        state: 'removed',
      });
      if (result) {
        await queries.deleteGroupRole(tx, groupId, targetUserId);
        await queries.incrementGroupMemberCount(groupId, -1, tx);
      }
      return result;
    });
    if (!membership) throw new NotFoundError('Active group member');
    return { ok: true };
  }

  async function inviteMember({ groupId, userId, targetUserId }) {
    const { group } = await requireModerator(groupId, userId);
    if (targetUserId === group.owner_id) {
      throw new ConflictError('The group owner is already a member');
    }
    const existing = await queries.findGroupMembership(groupId, targetUserId);
    if (existing?.state === 'active' || existing?.state === 'invited') {
      throw new ConflictError('User is already a member or has a pending invitation');
    }
    return db.tx(async (tx) => {
      const invitation = await queries.insertGroupInvitation(tx, {
        groupId,
        invitedUserId: targetUserId,
        invitedBy: userId,
      });
      await queries.insertGroupMembership(tx, {
        groupId,
        userId: targetUserId,
        state: 'invited',
      });
      return invitation;
    });
  }

  async function respondToInvitation({ groupId, userId, accepted }) {
    const invitation = await queries.findPendingGroupInvitation(groupId, userId);
    if (!invitation) throw new NotFoundError('Group invitation');
    return db.tx(async (tx) => {
      const updated = await queries.updateGroupInvitation(
        tx,
        invitation.id,
        accepted ? 'accepted' : 'declined'
      );
      if (!updated) throw new NotFoundError('Group invitation');
      await queries.insertGroupMembership(tx, {
        groupId,
        userId,
        state: accepted ? 'active' : 'left',
      });
      if (accepted) await queries.incrementGroupMemberCount(groupId, 1, tx);
      return updated;
    });
  }

  return {
    createGroup,
    getGroup,
    listGroupPosts,
    listPublicGroups,
    joinGroup,
    leaveGroup,
    listMembers,
    updateGroup,
    updateGroupImage,
    listJoinRequests,
    resolveJoinRequest,
    setMemberRole,
    removeMember,
    inviteMember,
    respondToInvitation,
  };
}

export default createGroupService;
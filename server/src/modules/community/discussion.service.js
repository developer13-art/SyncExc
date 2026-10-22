/**
 * SyncExc Server — Workspace discussion service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createDiscussionService({ db, queries, events, realtime, attachmentService, logger }) {
  async function createChannel({ name, kind }) {
    return db.tx(async (tx) => {
      return queries.insertChannel(tx, {
        workspaceId: null,
        isPublic: true,
        name,
        kind: kind || 'general',
      });
    });
  }

  async function listChannels() {
    return queries.listPublicChannels();
  }

  async function createThread({ userId, channelId, title }) {
    const channel = await queries.findChannelById(channelId);
    if (!channel || !channel.is_public || channel.group_id) {
      throw new NotFoundError('Channel');
    }
    return db.tx(async (tx) => {
      const thread = await queries.insertDiscussionThread(tx, {
        channelId,
        title,
        createdBy: userId,
      });

      await events.publish(
        tx,
        'community.thread_created',
        { threadId: thread.id, channelId },
        {
          actorId: userId,
          resourceType: 'community_thread',
          resourceId: thread.id,
        }
      );

      return thread;
    });
  }

  async function listThreads({ channelId, limit }) {
    const channel = await queries.findChannelById(channelId);
    if (!channel || !channel.is_public || channel.group_id) {
      throw new NotFoundError('Channel');
    }
    return queries.listDiscussionThreads(channelId, { limit });
  }

  async function postMessage({ userId, threadId, content, attachmentIds = [] }) {
    if ((!content || !content.trim()) && attachmentIds.length === 0) {
      throw new ConflictError('Message text or an attachment is required');
    }
    await requirePublicThread(threadId);
    return db.tx(async (tx) => {
      const message = await queries.insertDiscussionMessage(tx, {
        threadId,
        authorId: userId,
        content: content || '',
      });
      await attachmentService?.attach(tx, {
        userId,
        attachmentIds,
        resourceType: 'discussion_message',
        resourceId: message.id,
      });

      return message;
    }).then((message) => {
      if (realtime) {
        realtime.broadcast(`thread:${threadId}`, 'community.message_created', {
          messageId: message.id,
          threadId,
        });
      }
      return message;
    });
  }

  async function listMessages({ threadId, limit }) {
    await requirePublicThread(threadId);
    const rows = await queries.listDiscussionMessages(threadId, { limit });
    const attachmentRows = queries.listFilesForResources
      ? await queries.listFilesForResources(
          'discussion_message',
          rows.map((row) => row.id)
        )
      : [];
    const filesByMessage = new Map();
    for (const row of attachmentRows) {
      const files = filesByMessage.get(row.resource_id) || [];
      files.push({
        id: row.id,
        name: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        url: `/api/v1/community/attachments/${row.id}`,
      });
      filesByMessage.set(row.resource_id, files);
    }
    return rows.map((row) => ({ ...row, attachments: filesByMessage.get(row.id) || [] }));
  }

  async function requirePublicThread(threadId) {
    const thread = await queries.findDiscussionThreadById(threadId);
    if (!thread || !thread.is_public || thread.group_id) {
      throw new NotFoundError('Discussion thread');
    }
  }

  async function assertCanAccessMessage(messageId) {
    const message = await queries.findDiscussionMessageById(messageId);
    if (!message) throw new NotFoundError('Discussion message');
    const channel = await queries.findChannelById(message.channel_id);
    if (!channel?.is_public || channel.group_id) throw new NotFoundError('Discussion message');
  }

  return {
    createChannel,
    listChannels,
    createThread,
    listThreads,
    postMessage,
    listMessages,
    assertCanAccessMessage,
  };
}

export default createDiscussionService;
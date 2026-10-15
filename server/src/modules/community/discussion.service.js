/**
 * SyncExc Server — Workspace discussion service
 */

import { NotFoundError, AuthorizationError } from '../../lib/errors.js';

export function createDiscussionService({ db, queries, events, realtime, logger }) {
  async function createChannel({ userId, workspaceId, name, kind }) {
    // Verify workspace membership via workspaces module
    const { services } = arguments.length > 1 ? arguments[1] : { services: null };
    // Membership is verified by middleware before hitting this service
    return db.tx(async (tx) => {
      return queries.insertChannel(tx, {
        workspaceId,
        name,
        kind: kind || 'general',
      });
    });
  }

  async function listChannels({ workspaceId }) {
    return queries.listChannelsForWorkspace(workspaceId);
  }

  async function createThread({ userId, channelId, title }) {
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
    return queries.listDiscussionThreads(channelId, { limit });
  }

  async function postMessage({ userId, threadId, content }) {
    return db.tx(async (tx) => {
      const message = await queries.insertDiscussionMessage(tx, {
        threadId,
        authorId: userId,
        content,
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
    return queries.listDiscussionMessages(threadId, { limit });
  }

  return {
    createChannel,
    listChannels,
    createThread,
    listThreads,
    postMessage,
    listMessages,
  };
}

export default createDiscussionService;
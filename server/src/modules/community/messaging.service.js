import { AuthorizationError, ConflictError, NotFoundError } from '../../lib/errors.js';

export function createMessagingService({
  db,
  queries,
  messagingQueries,
  events,
  attachmentService,
}) {
  async function assertUnblocked(userId, otherUserId) {
    const blocked =
      (await queries.isBlocked(userId, otherUserId)) ||
      (await queries.isBlocked(otherUserId, userId));
    if (blocked) throw new AuthorizationError('Messaging is not available');
  }

  async function startConversation({ userId, recipientId, content, attachmentIds = [] }) {
    if ((!content || !content.trim()) && attachmentIds.length === 0) {
      throw new ConflictError('Message text or an attachment is required');
    }
    if (userId === recipientId) throw new ConflictError('Cannot message yourself');
    await assertUnblocked(userId, recipientId);

    const profile = await queries.findProfileByUserId(recipientId);
    if (!profile) throw new NotFoundError('Profile');
    const privacy = await queries.getProfilePrivacy(profile.id);
    if (!privacy?.allow_direct_messages) {
      throw new AuthorizationError('This user is not accepting message requests');
    }

    const [participantLow, participantHigh] = [userId, recipientId].sort();
    return db.tx(async (tx) => {
      let conversation = await messagingQueries.insertConversation(tx, {
        participantLow,
        participantHigh,
        createdBy: userId,
      });
      const createdNewRequest = Boolean(conversation);
      if (!conversation) {
        conversation = await messagingQueries.findConversationByPair(
          participantLow,
          participantHigh,
          tx
        );
      }
      if (!conversation) throw new ConflictError('Unable to start this conversation');
      if (conversation.state === 'rejected' || conversation.state === 'closed') {
        throw new AuthorizationError('This conversation is no longer available');
      }

      if (conversation.state === 'active') {
        return sendMessageInTransaction(tx, conversation, userId, content || '', attachmentIds);
      }
      if (conversation.created_by !== userId) {
        throw new AuthorizationError('A message request is already awaiting a response');
      }
      if (!createdNewRequest) return { conversation, requestPending: true };

      const message = await messagingQueries.insertMessage(tx, {
        conversationId: conversation.id,
        senderId: userId,
        content: content || '',
      });
      await attachmentService?.attach(tx, {
        userId,
        attachmentIds,
        resourceType: 'direct_message',
        resourceId: message.id,
      });
      await messagingQueries.touchConversation(tx, conversation.id, userId, message.created_at);
      await events.publish(
        tx,
        'community.message_request_created',
        {
          userId: recipientId,
          conversationId: conversation.id,
          messageId: message.id,
        },
        {
          actorId: userId,
          resourceType: 'community_conversation',
          resourceId: conversation.id,
        }
      );
      return { conversation, message, requestPending: true };
    });
  }

  async function sendMessageInTransaction(tx, conversation, senderId, content, attachmentIds = []) {
    const message = await messagingQueries.insertMessage(tx, {
      conversationId: conversation.id,
      senderId,
      content,
    });
    await attachmentService?.attach(tx, {
      userId: senderId,
      attachmentIds,
      resourceType: 'direct_message',
      resourceId: message.id,
    });
    await messagingQueries.touchConversation(tx, conversation.id, senderId, message.created_at);
    const recipientId =
      conversation.participant_low === senderId
        ? conversation.participant_high
        : conversation.participant_low;
    await events.publish(
      tx,
      'community.message_received',
      {
        userId: recipientId,
        conversationId: conversation.id,
        messageId: message.id,
      },
      {
        actorId: senderId,
        resourceType: 'community_conversation',
        resourceId: conversation.id,
      }
    );
    return { conversation, message, requestPending: false };
  }

  async function listConversations({ userId, limit, cursor }) {
    return messagingQueries.listConversations(userId, { limit, cursor });
  }

  async function listRequests({ userId, limit }) {
    return messagingQueries.listRequests(userId, { limit });
  }

  async function resolveRequest({ userId, conversationId, accepted }) {
    const conversation = await messagingQueries.findConversationForUser(conversationId, userId);
    if (!conversation) throw new NotFoundError('Conversation');
    if (conversation.created_by === userId) {
      throw new AuthorizationError('Only the recipient can respond to this request');
    }
    await assertUnblocked(userId, conversation.created_by);
    if (conversation.state !== 'pending') {
      throw new ConflictError('This message request has already been handled');
    }

    return db.tx(async (tx) => {
      const updated = await messagingQueries.setConversationState(
        tx,
        conversationId,
        accepted ? 'active' : 'rejected'
      );
      if (!updated) throw new ConflictError('This message request has already been handled');

      await events.publish(
        tx,
        accepted ? 'community.message_request_accepted' : 'community.message_request_rejected',
        {
          userId: conversation.created_by,
          conversationId,
        },
        {
          actorId: userId,
          resourceType: 'community_conversation',
          resourceId: conversationId,
        }
      );
      return updated;
    });
  }

  async function listMessages({ userId, conversationId, limit, cursor }) {
    const conversation = await messagingQueries.findConversationForUser(conversationId, userId);
    if (!conversation) throw new NotFoundError('Conversation');
    await assertUnblocked(
      userId,
      conversation.participant_low === userId
        ? conversation.participant_high
        : conversation.participant_low
    );
    if (conversation.state === 'rejected' || conversation.state === 'closed') {
      throw new AuthorizationError('This conversation is no longer available');
    }
    const result = await messagingQueries.listMessages(conversationId, { limit, cursor });
    const attachmentRows = queries.listFilesForResources
      ? await queries.listFilesForResources(
          'direct_message',
          result.rows.map((message) => message.id)
        )
      : [];
    const attachmentsByMessage = new Map();
    for (const row of attachmentRows) {
      const files = attachmentsByMessage.get(row.resource_id) || [];
      files.push({
        id: row.id,
        name: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: Number(row.size_bytes),
        url: `/api/v1/community/attachments/${row.id}`,
      });
      attachmentsByMessage.set(row.resource_id, files);
    }
    result.rows = result.rows.map((message) => ({
      ...message,
      attachments: attachmentsByMessage.get(message.id) || [],
    }));
    if (conversation.state === 'active') {
      await messagingQueries.markRead(conversationId, userId);
    }
    return result;
  }

  async function sendMessage({ userId, conversationId, content, attachmentIds = [] }) {
    if ((!content || !content.trim()) && attachmentIds.length === 0) {
      throw new ConflictError('Message text or an attachment is required');
    }
    const conversation = await messagingQueries.findConversationForUser(conversationId, userId);
    if (!conversation) throw new NotFoundError('Conversation');
    const recipientId =
      conversation.participant_low === userId
        ? conversation.participant_high
        : conversation.participant_low;
    await assertUnblocked(userId, recipientId);
    if (conversation.state !== 'active') {
      throw new AuthorizationError('Accept the message request before replying');
    }

    return db.tx((tx) =>
      sendMessageInTransaction(tx, conversation, userId, content || '', attachmentIds)
    );
  }

  async function assertCanAccessMessage({ userId, messageId }) {
    const message = await messagingQueries.findMessageById(messageId);
    if (!message) throw new NotFoundError('Message');
    const conversation = await messagingQueries.findConversationForUser(
      message.conversation_id,
      userId
    );
    if (!conversation) throw new NotFoundError('Message');
    const recipientId = conversation.participant_low === userId
      ? conversation.participant_high
      : conversation.participant_low;
    await assertUnblocked(userId, recipientId);
    if (conversation.state === 'rejected' || conversation.state === 'closed') {
      throw new NotFoundError('Message');
    }
  }

  return {
    startConversation,
    listConversations,
    listRequests,
    resolveRequest,
    listMessages,
    sendMessage,
    assertCanAccessMessage,
  };
}

export default createMessagingService;

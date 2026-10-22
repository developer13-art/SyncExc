import { ConflictError, NotFoundError } from '../../lib/errors.js';

export function createCommunityContentService({ db, queries, postService }) {
  async function votePoll({ userId, postId, optionIds, workspaceId = null }) {
    await postService.getPost({ postId, viewerId: userId, workspaceId });
    const uniqueOptionIds = [...new Set(optionIds)];
    if (uniqueOptionIds.length !== optionIds.length || uniqueOptionIds.length === 0) {
      throw new ConflictError('Select one or more unique poll options');
    }

    await db.tx(async (tx) => {
      const poll = await queries.lockPoll(postId, tx);
      if (!poll) throw new NotFoundError('Poll');
      if (poll.closes_at && new Date(poll.closes_at) <= new Date()) {
        throw new ConflictError('This poll is closed');
      }
      if (!poll.allow_multiple && uniqueOptionIds.length !== 1) {
        throw new ConflictError('This poll allows one choice');
      }
      const validOptions = await queries.listPollOptionIds(postId, uniqueOptionIds, tx);
      if (validOptions.length !== uniqueOptionIds.length) {
        throw new ConflictError('One or more selected options do not belong to this poll');
      }
      await queries.replacePollVotes(tx, postId, userId, uniqueOptionIds);
    });

    return (await postService.getPost({ postId, viewerId: userId, workspaceId })).post.poll;
  }

  async function updateEventRsvp({ userId, postId, status, workspaceId = null }) {
    await postService.getPost({ postId, viewerId: userId, workspaceId });

    await db.tx(async (tx) => {
      const event = await queries.lockEvent(postId, tx);
      if (!event) throw new NotFoundError('Event');
      const existing = await queries.findEventRsvp(postId, userId, tx);
      if (
        status === 'going' &&
        event.capacity !== null &&
        existing?.status !== 'going' &&
        (await queries.countGoingRsvps(postId, tx)) >= event.capacity
      ) {
        throw new ConflictError('This event is at capacity');
      }
      await queries.upsertEventRsvp(tx, postId, userId, status);
    });

    return (await postService.getPost({ postId, viewerId: userId, workspaceId })).post.event;
  }

  return { votePoll, updateEventRsvp };
}

export default createCommunityContentService;

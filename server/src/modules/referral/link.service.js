/**
 * SyncExc Server — Referral link service
 */

import { randomBytes } from 'node:crypto';
import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createLinkService({ db, queries, events, logger }) {
  function generateCode(length = 10) {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // No confusing chars
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  async function createLink({ userId, affiliateId, name, campaignLabel, trackingParams }) {
    let code;
    let attempts = 0;
    while (attempts < 10) {
      code = generateCode(10);
      const existing = await queries.findLinkByCode(code);
      if (!existing) break;
      attempts += 1;
    }
    if (attempts >= 10) throw new ConflictError('Unable to generate a unique code', 'CODE_GENERATION_FAILED');

    return db.tx(async (tx) => {
      const link = await queries.insertLink(tx, {
        affiliateId,
        code,
        name,
        campaignLabel,
        trackingParams,
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        affiliateId,
        action: 'referral_link.created',
        resourceType: 'referral_link',
        resourceId: link.id,
        after: { code, name },
      });

      return link;
    });
  }

  async function listLinks({ userId, affiliateId }) {
    return queries.listLinksForAffiliate(affiliateId);
  }

  async function getLinkByCode(code) {
    return queries.findLinkByCode(code);
  }

  async function pauseLink({ userId, affiliateId, linkId }) {
    const link = await queries.findLinkById(linkId);
    if (!link || link.affiliate_id !== affiliateId) throw new NotFoundError('Link');
    return queries.updateLinkStatus(linkId, 'paused');
  }

  async function resumeLink({ userId, affiliateId, linkId }) {
    const link = await queries.findLinkById(linkId);
    if (!link || link.affiliate_id !== affiliateId) throw new NotFoundError('Link');
    if (link.status === 'revoked') throw new ConflictError('Cannot resume a revoked link', 'REVOKED');
    return queries.updateLinkStatus(linkId, 'active');
  }

  async function revokeLink({ userId, affiliateId, linkId }) {
    const link = await queries.findLinkById(linkId);
    if (!link || link.affiliate_id !== affiliateId) throw new NotFoundError('Link');
    return queries.updateLinkStatus(linkId, 'revoked');
  }

  /**
   * Record a click on a referral link. Called by the public registration
   * flow before account creation.
   */
  async function recordClick({ code, ipAddress, userAgent, referrer }) {
    const link = await queries.findLinkByCode(code);
    if (!link) throw new NotFoundError('Referral link');
    if (link.status !== 'active') throw new ConflictError('Referral link is not active', 'LINK_INACTIVE');

    return db.tx(async (tx) => {
      const click = await queries.insertClick(tx, {
        linkId: link.id,
        affiliateId: link.affiliate_id,
        sessionRef: generateCode(20),
        ipAddress,
        userAgent,
        referrer,
      });
      return click;
    });
  }

  async function countClicks({ affiliateId, linkId, since }) {
    return queries.countClicksForLink(linkId, { since });
  }

  return {
    createLink,
    listLinks,
    getLinkByCode,
    pauseLink,
    resumeLink,
    revokeLink,
    recordClick,
    countClicks,
  };
}

export default createLinkService;
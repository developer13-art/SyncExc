/**
 * SyncExc Server — Affiliate service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

const CURRENT_AGREEMENT_VERSION = 'v1';

export function createAffiliateService({ db, queries, events, logger }) {
  async function enroll({ userId, acceptedAgreement, payoutCurrency, ipAddress, userAgent }) {
    if (!acceptedAgreement) {
      throw new ConflictError('Agreement acceptance required', 'AGREEMENT_REQUIRED');
    }

    const existing = await queries.findAffiliateByUserId(userId);
    if (existing) {
      if (existing.status === 'active') {
        return existing;
      }
      if (existing.status === 'suspended' || existing.status === 'terminated') {
        throw new ConflictError('Affiliate account is suspended', 'AFFILIATE_SUSPENDED');
      }
    }

    return db.tx(async (tx) => {
      const affiliate = await queries.insertAffiliate(tx, {
        userId,
        payoutCurrency: payoutCurrency || 'USD',
      });

      if (!affiliate) throw new ConflictError('Enrollment failed');

      await queries.insertAgreement(tx, {
        affiliateId: affiliate.id,
        version: CURRENT_AGREEMENT_VERSION,
        ipAddress,
        userAgent,
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        affiliateId: affiliate.id,
        action: 'affiliate.enrolled',
        resourceType: 'affiliate',
        resourceId: affiliate.id,
        after: { payoutCurrency },
      });

      await events.publish(
        tx,
        'referral.affiliate_enrolled',
        { affiliateId: affiliate.id, userId },
        {
          actorId: userId,
          resourceType: 'affiliate',
          resourceId: affiliate.id,
        }
      );

      return affiliate;
    });
  }

  async function getAffiliateByUserId(userId) {
    return queries.findAffiliateByUserId(userId);
  }

  async function getAffiliate(affiliateId) {
    const affiliate = await queries.findAffiliateById(affiliateId);
    if (!affiliate) throw new NotFoundError('Affiliate');
    return affiliate;
  }

  async function updateStatus({ affiliateId, status, reason, actorId }) {
    return db.tx(async (tx) => {
      const before = await queries.findAffiliateById(affiliateId);
      const updated = await queries.updateAffiliateStatus(affiliateId, status);

      await queries.insertAuditEvent(tx, {
        actorId,
        affiliateId,
        action: `affiliate.status.${status}`,
        resourceType: 'affiliate',
        resourceId: affiliateId,
        before: { status: before.status },
        after: { status: updated.status, reason },
      });

      return updated;
    });
  }

  return {
    enroll,
    getAffiliateByUserId,
    getAffiliate,
    updateStatus,
  };
}

export default createAffiliateService;
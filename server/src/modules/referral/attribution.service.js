/**
 * SyncExc Server — Attribution service
 *
 * Determines which affiliate, if any, receives credit for a new customer.
 *
 * Rules (deterministic and versioned):
 *   - 30-day attribution window
 *   - first eligible attribution is locked
 *   - one direct referrer per customer
 *   - server-side verification of the referral code at registration
 */

const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const POLICY_VERSION = 'v1';

export function createAttributionService({
  db,
  queries,
  linkService,
  affiliateService,
  events,
  logger,
}) {
  /**
   * Called during user registration with the referral code the user came through.
   */
  async function attributeRegistration({
    userId,
    referralCode,
    ipAddress,
    userAgent,
  }) {
    if (!referralCode) return null;

    const link = await linkService.getLinkByCode(referralCode);
    if (!link) return null;
    if (link.status !== 'active') {
      logger.debug({ referralCode, status: link.status }, 'Referral code inactive');
      return null;
    }

    const affiliate = await queries.findAffiliateById(link.affiliate_id);
    if (!affiliate || affiliate.status !== 'active') {
      return null;
    }

    // Self-referral guard: cannot refer your own account
    if (affiliate.user_id === userId) {
      logger.warn(
        { userId, affiliateId: affiliate.id },
        'Self-referral blocked'
      );
      return null;
    }

    // Check for existing attribution
    const existing = await queries.findAttributionByReferredUser(userId);
    if (existing) return existing;

    return db.tx(async (tx) => {
      const attribution = await queries.insertAttribution(tx, {
        affiliateId: affiliate.id,
        linkId: link.id,
        referredUserId: userId,
        policyVersion: POLICY_VERSION,
      });

      if (!attribution) return null;

      await queries.insertAttributionEvent(tx, {
        attributionId: attribution.id,
        eventType: 'attributed',
        metadata: {
          referralCode,
          ipAddress,
          userAgent,
          linkId: link.id,
        },
      });

      await events.publish(
        tx,
        'referral.attributed',
        {
          attributionId: attribution.id,
          affiliateId: affiliate.id,
          referredUserId: userId,
          referralCode,
        },
        {
          resourceType: 'referral_attribution',
          resourceId: attribution.id,
        }
      );

      return attribution;
    });
  }

  async function getAttributionForUser(userId) {
    return queries.findAttributionByReferredUser(userId);
  }

  async function getAttribution(attributionId) {
    return queries.findAttributionById(attributionId);
  }

  async function listAttributions({ affiliateId, limit, cursor }) {
    return queries.listAttributionsForAffiliate(affiliateId, { limit, cursor });
  }

  async function markConverted({ attributionId, actorId }) {
    return db.tx(async (tx) => {
      const updated = await queries.updateAttributionState(attributionId, 'converted', {
        convertedAt: new Date(),
      });

      if (!updated) return null;

      await queries.insertAttributionEvent(tx, {
        attributionId,
        eventType: 'converted',
        actorId,
      });

      return updated;
    });
  }

  return {
    attributeRegistration,
    getAttributionForUser,
    getAttribution,
    listAttributions,
    markConverted,
    POLICY_VERSION,
    ATTRIBUTION_WINDOW_MS,
  };
}

export default createAttributionService;
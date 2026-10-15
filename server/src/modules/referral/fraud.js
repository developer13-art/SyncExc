/**
 * SyncExc Server — Fraud detection
 *
 * Real rules that evaluate affiliate behavior. Signals are weighted, not
 * binary: a single weak signal never auto-penalizes.
 */

const SIGNAL_WEIGHTS = {
  self_referral: 100,
  duplicate_account_signal: 40,
  abnormal_registration_burst: 30,
  click_flood: 25,
  high_reversal_rate: 35,
  payout_method_reuse: 50,
  rapid_attribution: 15,
};

const REVIEW_THRESHOLD = 60;

export function createFraudService({ db, queries, events, logger }) {
  /**
   * Screen a new payout request for fraud signals.
   */
  async function screenPayoutRequest({ affiliateId, amountMinor, currency, methodId }) {
    const signals = [];
    let score = 0;

    // Signal 1: self-referral check
    const selfReferral = await db.query(
      `
      SELECT 1 FROM referral_attributions a
      JOIN affiliates af ON af.id = a.affiliate_id
      WHERE af.id = $1 AND a.referred_user_id = af.user_id
      LIMIT 1
      `,
      [affiliateId]
    );
    if (selfReferral.rows.length > 0) {
      signals.push({ type: 'self_referral' });
      score += SIGNAL_WEIGHTS.self_referral;
    }

    // Signal 2: burst of registrations in last 24h
    const burst = await db.query(
      `
      SELECT count(*)::int AS count
      FROM referral_attributions
      WHERE affiliate_id = $1 AND created_at > now() - interval '24 hours'
      `,
      [affiliateId]
    );
    if (burst.rows[0].count > 20) {
      signals.push({ type: 'abnormal_registration_burst', count: burst.rows[0].count });
      score += SIGNAL_WEIGHTS.abnormal_registration_burst;
    }

    // Signal 3: high reversal rate (reversed commissions / total accruals)
    const reversalStats = await db.query(
      `
      SELECT
        COALESCE(sum(CASE WHEN state = 'reversed' THEN 1 ELSE 0 END), 0)::int AS reversed_count,
        count(*)::int AS total
      FROM commission_accruals
      WHERE affiliate_id = $1
      `,
      [affiliateId]
    );
    const reversedCount = reversalStats.rows[0].reversed_count;
    const totalCount = reversalStats.rows[0].total;
    if (totalCount >= 5) {
      const ratio = reversedCount / totalCount;
      if (ratio > 0.3) {
        signals.push({ type: 'high_reversal_rate', ratio });
        score += SIGNAL_WEIGHTS.high_reversal_rate;
      }
    }

    // Signal 4: same payout method used by other affiliates
    const method = await queries.findPayoutMethodById(methodId);
    if (method) {
      const reuse = await db.query(
        `
        SELECT count(*)::int AS count
        FROM affiliate_payout_methods
        WHERE provider = $1 AND provider_token = $2
          AND affiliate_id <> $3 AND status = 'active'
        `,
        [method.provider, method.provider_token, affiliateId]
      );
      if (reuse.rows[0].count > 0) {
        signals.push({ type: 'payout_method_reuse', count: reuse.rows[0].count });
        score += SIGNAL_WEIGHTS.payout_method_reuse;
      }
    }

    // Signal 5: click flood in last 24h
    const links = await queries.listLinksForAffiliate(affiliateId);
    let totalClicks = 0;
    for (const link of links) {
      const c = await queries.countClicksForLink(link.id, {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      totalClicks += c;
    }
    if (totalClicks > 1000) {
      signals.push({ type: 'click_flood', count: totalClideps = totalClicks });
      score += SIGNAL_WEIGHTS.click_flood;
    }

    const requiresReview = score >= REVIEW_THRESHOLD;

    if (requiresReview) {
      await db.tx(async (tx) => {
        await queries.insertFraudCase(tx, {
          affiliateId,
          severity: score >= 100 ? 'high' : 'medium',
          evidence: { signals, score, amountMinor, currency },
        });

        await events.publish(
          tx,
          'referral.fraud_case_opened',
          { affiliateId, signals, score },
          {
            resourceType: 'affiliate_fraud_case',
            resourceId: affiliateId,
          }
        );
      });

      logger.warn({ affiliateId, signals, score }, 'Payout held for fraud review');
    }

    return { requiresReview, signals, score };
  }

  async function listCases({ state, limit }) {
    return queries.listFraudCases({ state, limit });
  }

  async function decideCase({ caseId, actorId, decision, reason }) {
    return db.tx(async (tx) => {
      const updated = await queries.updateFraudCaseState(caseId, decision);

      await queries.insertAuditEvent(tx, {
        actorId,
        action: `fraud_case.${decision}`,
        resourceType: 'affiliate_fraud_case',
        resourceId: caseId,
        after: { decision, reason },
      });

      return updated;
    });
  }

  return {
    screenPayoutRequest,
    listCases,
    decideCase,
  };
}

export default createFraudService;
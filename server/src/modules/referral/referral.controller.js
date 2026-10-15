/**
 * SyncExc Server — Referral controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeAffiliate, serializeCommissionAccrual, serializePayout } from '../../lib/serializers.js';

export function createReferralController(services) {
  const {
    affiliateService,
    linkService,
    commissionService,
    commissionPolicyService,
    payoutService,
    dashboardService,
    fraudService,
  } = services;

  return {
    /* Enrollment */
    async getProfile(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return success(res, null);
      return success(res, serializeAffiliate(affiliate));
    },

    async enroll(req, res) {
      const affiliate = await affiliateService.enroll({
        userId: req.auth.userId,
        acceptedAgreement: req.body.acceptedAgreement,
        payoutCurrency: req.body.payoutCurrency || 'USD',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return created(res, serializeAffiliate(affiliate));
    },

    /* Links */
    async listLinks(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return success(res, []);
      const links = await linkService.listLinks({
        userId: req.auth.userId,
        affiliateId: affiliate.id,
      });
      return success(res, links);
    },

    async createLink(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return res.status(404).json({ error: { code: 'NOT_AFFILIATE', message: 'Not an affiliate' } });

      const link = await linkService.createLink({
        userId: req.auth.userId,
        affiliateId: affiliate.id,
        name: req.body.name,
        campaignLabel: req.body.campaignLabel,
        trackingParams: req.body.trackingParams,
      });
      return created(res, link);
    },

    async pauseLink(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return res.status(404).json({ error: { code: 'NOT_AFFILIATE', message: 'Not an affiliate' } });
      const result = await linkService.pauseLink({
        userId: req.auth.userId,
        affiliateId: affiliate.id,
        linkId: req.params.linkId,
      });
      return success(res, result);
    },

    async resumeLink(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return res.status(404).json({ error: { code: 'NOT_AFFILIATE', message: 'Not an affiliate' } });
      const result = await linkService.resumeLink({
        userId: req.auth.userId,
        affiliateId: affiliate.id,
        linkId: req.params.linkId,
      });
      return success(res, result);
    },

    async revokeLink(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return res.status(404).json({ error: { code: 'NOT_AFFILIATE', message: 'Not an affiliate' } });
      const result = await linkService.revokeLink({
        userId: req.auth.userId,
        affiliateId: affiliate.id,
        linkId: req.params.linkId,
      });
      return success(res, result);
    },

    /* Public click recording (called during registration flow) */
    async recordClick(req, res) {
      const click = await linkService.recordClick({
        code: req.body.code,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        referrer: req.body.referrer,
      });
      return created(res, { clickId: click.id });
    },

    /* Dashboard */
    async getDashboard(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return res.status(404).json({ error: { code: 'NOT_AFFILIATE', message: 'Not an affiliate' } });
      const dashboard = await dashboardService.getDashboard({
        affiliateId: affiliate.id,
        currency: affiliate.payout_currency || 'USD',
      });
      return success(res, dashboard);
    },

    /* Commissions */
    async listCommissions(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return success(res, []);
      const accruals = await commissionService.listAccruals({
        affiliateId: affiliate.id,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, accruals.map(serializeCommissionAccrual));
    },

    async listLedger(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return success(res, []);
      const entries = await services.ledgerService?.listEntries?.({
        affiliateId: affiliate.id,
        limit: Number(req.query.limit) || 100,
      });
      return success(res, entries || []);
    },

    /* Payouts */
    async listPayoutMethods(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return success(res, []);
      const methods = await services.queries.listPayoutMethods(affiliate.id);
      return success(res, methods);
    },

    async listPayouts(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return success(res, []);
      const payouts = await payoutService.listPayouts({
        affiliateId: affiliate.id,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, payouts.map(serializePayout));
    },

    async requestPayout(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return res.status(404).json({ error: { code: 'NOT_AFFILIATE', message: 'Not an affiliate' } });

      const payout = await payoutService.requestPayout({
        userId: req.auth.userId,
        affiliateId: affiliate.id,
        methodId: req.body.methodId,
        amountMinor: req.body.amountMinor,
        currency: req.body.currency || affiliate.payout_currency || 'USD',
      });
      return created(res, serializePayout(payout));
    },

    async getPayout(req, res) {
      const affiliate = await affiliateService.getAffiliateByUserId(req.auth.userId);
      if (!affiliate) return res.status(404).json({ error: { code: 'NOT_AFFILIATE', message: 'Not an affiliate' } });
      const payout = await payoutService.getPayout({
        payoutId: req.params.payoutId,
        affiliateId: affiliate.id,
      });
      return success(res, serializePayout(payout));
    },

    /* Admin - Commission Policies */
    async listPolicies(req, res) {
      const policies = await commissionPolicyService.listPolicies({
        status: req.query.status,
      });
      return success(res, policies);
    },

    async createPolicy(req, res) {
      const result = await commissionPolicyService.createPolicy({
        userId: req.auth.userId,
        name: req.body.name,
        config: req.body.config,
        effectiveFrom: req.body.effectiveFrom,
      });
      return created(res, result);
    },

    async publishPolicy(req, res) {
      const policy = await commissionPolicyService.publishPolicy({
        userId: req.auth.userId,
        policyId: req.params.policyId,
      });
      return success(res, policy);
    },

    /* Admin - Fraud */
    async listFraudCases(req, res) {
      const cases = await fraudService.listCases({
        state: req.query.state,
        limit: Number(req.query.limit) || 50,
      });
      return success(res, cases);
    },

    async decideFraudCase(req, res) {
      const result = await fraudService.decideCase({
        caseId: req.params.caseId,
        actorId: req.auth.userId,
        decision: req.body.decision,
        reason: req.body.reason,
      });
      return success(res, result);
    },
  };
}

export default createReferralController;
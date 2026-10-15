/**
 * SyncExc Server — Marketplace controller
 */

import { success, created, paginated } from '../../lib/response.js';
import { serializeProvider, serializeCopyConfiguration } from '../../lib/serializers.js';

export function createMarketplaceController(services) {
  const {
    providerService,
    publicationService,
    followService,
    subscriptionService,
    copyConfigurationService,
    copyOrchestrationService,
    performanceService,
    disclosureService,
    moderationService,
  } = services;

  return {
    /* Providers */
    async listProviders(req, res) {
      const { rows, nextCursor } = await providerService.listProviders({
        moderationState: 'approved',
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows.map(serializeProvider), {
        nextCursor,
        limit: Number(req.query.limit) || 50,
      });
    },

    async createProvider(req, res) {
      const provider = await providerService.createProvider({
        userId: req.auth.userId,
        handle: req.body.handle,
        displayName: req.body.displayName,
        accountType: req.body.accountType,
        biography: req.body.biography,
        methodology: req.body.methodology,
        supportedMarkets: req.body.supportedMarkets,
        supportedLanguages: req.body.supportedLanguages,
      });
      return created(res, serializeProvider(provider));
    },

    async getProvider(req, res) {
      const provider = await providerService.getProvider(req.params.providerId);
      if (!provider) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Provider not found' } });
      return success(res, serializeProvider(provider));
    },

    async getMyProvider(req, res) {
      const provider = await providerService.getProviderForUser(req.auth.userId);
      if (!provider) return success(res, null);
      return success(res, serializeProvider(provider));
    },

    async updateProvider(req, res) {
      const provider = await providerService.updateProvider({
        userId: req.auth.userId,
        providerId: req.params.providerId,
        updates: req.body,
      });
      return success(res, serializeProvider(provider));
    },

    /* Publications */
    async publishSignal(req, res) {
      const provider = await providerService.getProviderForUser(req.auth.userId);
      if (!provider) return res.status(404).json({ error: { code: 'NOT_PROVIDER', message: 'Not a provider' } });

      const signal = await publicationService.publishSignal({
        userId: req.auth.userId,
        providerId: provider.id,
        instrument: req.body.instrument,
        marketType: req.body.marketType,
        direction: req.body.direction,
        entry: req.body.entry,
        entryRange: req.body.entryRange,
        stopLoss: req.body.stopLoss,
        targets: req.body.targets,
        leverage: req.body.leverage,
        validUntil: req.body.validUntil,
        disclosures: req.body.disclosures,
        sourceEvidence: req.body.sourceEvidence,
      });
      return created(res, signal);
    },

    async listSignals(req, res) {
      const { rows, nextCursor } = await publicationService.listSignals({
        providerId: req.params.providerId,
        status: req.query.status,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, { nextCursor, limit: Number(req.query.limit) || 50 });
    },

    async cancelSignal(req, res) {
      const signal = await publicationService.cancelSignal({
        userId: req.auth.userId,
        signalId: req.params.signalId,
        reason: req.body.reason,
      });
      return success(res, signal);
    },

    /* Follows */
    async follow(req, res) {
      const result = await followService.follow({
        userId: req.auth.userId,
        providerId: req.params.providerId,
      });
      return created(res, result);
    },

    async unfollow(req, res) {
      const result = await followService.unfollow({
        userId: req.auth.userId,
        providerId: req.params.providerId,
      });
      return success(res, result);
    },

    async listFollowing(req, res) {
      const follows = await followService.listFollowing({ userId: req.auth.userId });
      return success(res, follows);
    },

    /* Subscriptions */
    async subscribe(req, res) {
      const subscription = await subscriptionService.subscribe({
        userId: req.auth.userId,
        providerId: req.params.providerId,
        planId: req.body.planId,
        workspaceId: req.workspace?.id || null,
      });
      return created(res, subscription);
    },

    async cancelSubscription(req, res) {
      const result = await subscriptionService.cancel({
        userId: req.auth.userId,
        subscriptionId: req.params.subscriptionId,
      });
      return success(res, result);
    },

    async listSubscriptions(req, res) {
      const subscriptions = await subscriptionService.listSubscriptions({ userId: req.auth.userId });
      return success(res, subscriptions);
    },

    /* Copy configurations */
    async listCopyConfigurations(req, res) {
      const configs = await copyConfigurationService.listConfigurations({
        workspaceId: req.workspace.id,
        status: req.query.status,
      });
      return success(res, configs.map(serializeCopyConfiguration));
    },

    async createCopyConfiguration(req, res) {
      const config = await copyConfigurationService.createConfiguration({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        providerId: req.body.providerId,
        providerPlanId: req.body.providerPlanId,
        destinationAccounts: req.body.destinationAccounts,
        marketTypes: req.body.marketTypes,
        instrumentFilters: req.body.instrumentFilters,
        sizingRule: req.body.sizingRule,
        executionMode: req.body.executionMode,
      });
      return created(res, serializeCopyConfiguration(config));
    },

    async getCopyConfiguration(req, res) {
      const result = await copyConfigurationService.getConfiguration({
        configId: req.params.configId,
        workspaceId: req.workspace.id,
      });
      return success(res, {
        config: serializeCopyConfiguration(result.config),
        destinations: result.destinations,
      });
    },

    async activateCopyConfiguration(req, res) {
      const config = await copyConfigurationService.activate({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        configId: req.params.configId,
      });
      return success(res, serializeCopyConfiguration(config));
    },

    async pauseCopyConfiguration(req, res) {
      const config = await copyConfigurationService.pause({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        configId: req.params.configId,
      });
      return success(res, serializeCopyConfiguration(config));
    },

    async revokeCopyConfiguration(req, res) {
      const config = await copyConfigurationService.revoke({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        configId: req.params.configId,
      });
      return success(res, serializeCopyConfiguration(config));
    },

    /* Copy results */
    async listCopyResults(req, res) {
      const results = await copyOrchestrationService.listRecordsForWorkspace(
        req.workspace.id,
        { limit: Number(req.query.limit) || 50 }
      );
      return success(res, results);
    },

    /* Performance */
    async listPerformanceReports(req, res) {
      const reports = await performanceService.listReports({
        providerId: req.params.providerId,
        limit: Number(req.query.limit) || 20,
      });
      return success(res, reports);
    },

    /* Disclosures */
    async listDisclosures(req, res) {
      const disclosures = await disclosureService.listForProvider({
        providerId: req.params.providerId,
      });
      return success(res, disclosures);
    },

    async acceptDisclosure(req, res) {
      const result = await disclosureService.accept({
        userId: req.auth.userId,
        disclosureId: req.params.disclosureId,
      });
      return success(res, result);
    },

    /* Moderation (admin) */
    async listModerationCases(req, res) {
      const { rows, nextCursor } = await moderationService.list({
        state: req.query.state,
        limit: Number(req.query.limit) || 50,
        cursor: req.query.cursor || null,
      });
      return paginated(res, rows, { nextCursor, limit: Number(req.query.limit) || 50 });
    },

    async decideModeration(req, res) {
      const result = await moderationService.decide({
        caseId: req.params.caseId,
        actorId: req.auth.userId,
        action: req.body.action,
        reason: req.body.reason,
      });
      return success(res, result);
    },
  };
}

export default createMarketplaceController;
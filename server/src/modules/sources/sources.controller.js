/**
 * SyncExc Server — Sources controller
 */

import { success, created, noContent, paginated } from '../../lib/response.js';
import { serializeSource, serializeSourceCandidate } from '../../lib/serializers.js';

export function createSourcesController(services) {
  const {
    sourceRegistryService,
    discoveryService,
    reviewService,
    validationService,
    healthService,
    qualityService,
    sandboxService,
    connectionService,
    telegramAuthService,
    duplicateDetectionService,
    queries,
  } = services;

  return {
    async listCategories(_req, res) {
      return success(res, await queries.listCategories());
    },

    async telegramSendCode(req, res) {
      const result = await telegramAuthService.sendCode({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        phoneNumber: req.body.phoneNumber,
      });
      return success(res, result);
    },

    async telegramVerifyCode(req, res) {
      const result = await telegramAuthService.verifyCode({
        loginId: req.body.loginId,
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        code: req.body.code,
        password: req.body.password,
      });
      return success(res, result);
    },

    async telegramListChannels(req, res) {
      const result = await telegramAuthService.listChannels({
        loginId: req.body.loginId,
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    async telegramCreateSources(req, res) {
      const result = await telegramAuthService.createSources({
        loginId: req.body.loginId,
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        channelIds: req.body.channelIds,
      });
      return created(res, result.map(serializeSource));
    },

    async telegramReauthorizeSource(req, res) {
      const result = await telegramAuthService.reauthorizeSource({
        loginId: req.body.loginId,
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.body.sourceId,
        channelId: req.body.channelId,
      });
      return success(res, result);
    },

    async telegramCancelLogin(req, res) {
      const result = await telegramAuthService.cancel({
        loginId: req.body.loginId,
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    /* Sources */
    async list(req, res) {
      const sources = await sourceRegistryService.listSources({
        workspaceId: req.workspace.id,
        status: req.query.status,
        type: req.query.type,
      });
      return success(res, sources.map(serializeSource));
    },

    async create(req, res) {
      const source = await sourceRegistryService.registerSource({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        type: req.body.type,
        name: req.body.name,
        identifier: req.body.identifier,
        url: req.body.url,
        providerName: req.body.providerName,
        marketCoverage: req.body.marketCoverage,
        exchangeCoverage: req.body.exchangeCoverage,
        assetCoverage: req.body.assetCoverage,
        primaryLanguage: req.body.primaryLanguage,
        categories: req.body.categories,
        accessMethod: req.body.accessMethod,
      });
      return created(res, serializeSource(source));
    },

    async get(req, res) {
      const source = await sourceRegistryService.getSourceForWorkspace({
        sourceId: req.params.sourceId,
        workspaceId: req.workspace.id,
      });
      return success(res, serializeSource(source));
    },

    async getConnection(req, res) {
      const connection = await connectionService.getConnection({
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
      });
      return success(res, connection);
    },

    async listTelegramMessages(req, res) {
      const messages = await connectionService.listTelegramMessages({
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
        limit: Number(req.query.limit) || 8,
      });
      return success(res, messages);
    },

    async update(req, res) {
      const source = await sourceRegistryService.updateSource({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
        updates: req.body,
      });
      return success(res, serializeSource(source));
    },

    async activate(req, res) {
      const source = await sourceRegistryService.activateSource({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
      });
      return success(res, serializeSource(source));
    },

    async pause(req, res) {
      const source = await sourceRegistryService.pauseSource({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
        reason: req.body.reason,
      });
      return success(res, serializeSource(source));
    },

    async archive(req, res) {
      const source = await sourceRegistryService.archiveSource({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
      });
      return success(res, serializeSource(source));
    },

    async setMonitoring(req, res) {
      const source = await sourceRegistryService.setMonitoring({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
        enabled: req.body.enabled,
      });
      return success(res, serializeSource(source));
    },

    async getExecutionConfig(req, res) {
      const config = await sourceRegistryService.getExecutionConfig({
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
      });
      return success(res, config);
    },

    async updateExecutionConfig(req, res) {
      const config = await sourceRegistryService.updateExecutionConfig({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
        mode: req.body.mode,
        settings: req.body.settings,
        destinationAccountIds: req.body.destinationAccountIds,
      });
      return success(res, config);
    },

    /* Connections */
    async authorizeConnection(req, res) {
      const result = await connectionService.authorize({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
        credentials: req.body.credentials,
      });
      return success(res, result);
    },

    async testConnection(req, res) {
      const result = await connectionService.testConnection({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
      });
      return success(res, result);
    },

    async disconnectConnection(req, res) {
      const result = await connectionService.disconnect({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        sourceId: req.params.sourceId,
      });
      return success(res, result);
    },

    /* Validation */
    async runValidation(req, res) {
      const result = await validationService.runValidation({
        sourceId: req.params.sourceId,
        userId: req.auth.userId,
      });
      return success(res, result);
    },

    async listValidations(req, res) {
      const result = await validationService.listValidations({
        sourceId: req.params.sourceId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    /* Health & quality */
    async getHealth(req, res) {
      const result = await healthService.getHealth({
        sourceId: req.params.sourceId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    async checkHealth(req, res) {
      const result = await healthService.checkSource({
        sourceId: req.params.sourceId,
        userId: req.auth.userId,
      });
      return success(res, result);
    },

    async getQuality(req, res) {
      const result = await qualityService.getQuality({
        sourceId: req.params.sourceId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    /* Sandbox */
    async runSandbox(req, res) {
      const result = await sandboxService.testParsing({
        sourceId: req.params.sourceId,
        workspaceId: req.workspace.id,
        sampleSize: req.body.sampleSize || 10,
      });
      return success(res, result);
    },

    /* Discovery */
    async createDiscoveryJob(req, res) {
      const job = await discoveryService.createDiscoveryJob({
        userId: req.auth.userId,
        workspaceId: req.workspace.id,
        filters: req.body.filters,
        maxCandidates: req.body.maxCandidates,
      });
      return created(res, job);
    },

    async listDiscoveryJobs(req, res) {
      const jobs = await discoveryService.listJobs({
        workspaceId: req.workspace.id,
      });
      return success(res, jobs);
    },

    async getDiscoveryJob(req, res) {
      const result = await discoveryService.getJob({
        jobId: req.params.jobId,
        workspaceId: req.workspace.id,
      });
      return success(res, result);
    },

    async listCandidates(req, res) {
      const candidates = await discoveryService.listCandidates({
        workspaceId: req.workspace.id,
        status: req.query.status,
      });
      return success(res, candidates.map(serializeSourceCandidate));
    },

    async getCandidate(req, res) {
      const candidate = await discoveryService.getCandidate({
        candidateId: req.params.candidateId,
        workspaceId: req.workspace.id,
      });
      return success(res, serializeSourceCandidate(candidate));
    },

    /* Review */
    async submitReview(req, res) {
      const review = await reviewService.submitDecision({
        reviewerId: req.auth.userId,
        workspaceId: req.workspace.id,
        targetType: req.body.targetType,
        targetId: req.body.targetId,
        decision: req.body.decision,
        scope: req.body.scope,
        reason: req.body.reason,
      });
      return created(res, review);
    },
  };
}

export default createSourcesController;

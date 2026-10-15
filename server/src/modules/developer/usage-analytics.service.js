/**
 * SyncExc Server — Usage analytics service
 */

export function createUsageAnalyticsService({ db, queries, logger }) {
  async function recordRequest({
    applicationId,
    credentialId,
    method,
    path,
    status,
    durationMs,
    requestId,
    errorCode,
  }) {
    try {
      await queries.insertApiRequestLog(db, {
        applicationId,
        credentialId,
        method,
        path,
        status,
        durationMs,
        requestId,
        errorCode,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to record API request');
    }
  }

  async function getSummary({ applicationId, workspaceId, since, until }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) {
      throw new Error('Application not found');
    }
    return queries.getUsageSummary({ applicationId, since, until });
  }

  async function getByEndpoint({ applicationId, workspaceId, since }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) {
      throw new Error('Application not found');
    }
    return queries.getUsageByEndpoint({ applicationId, since });
  }

  return {
    recordRequest,
    getSummary,
    getByEndpoint,
  };
}

export default createUsageAnalyticsService;
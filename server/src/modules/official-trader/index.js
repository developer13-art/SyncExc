/**
 * SyncExc Server — Official SyncExc AI Trader module
 *
 * Execution-backed official trader. This module composes:
 *   - deterministic market research (real exchange candles)
 *   - deterministic validation and risk checks
 *   - execution through administrator-assigned company exchange accounts
 *   - fill reconciliation and closed-trade attribution
 *   - verified-only marketplace publication
 *   - performance derived from reconciled exchange records
 *
 * The AI may propose trades, but only the deterministic validation and
 * execution services can authorise an order. No admin route places, modifies,
 * or closes a user's trade, and no exchange credential is returned to a client.
 */

import { createLogger } from '../../lib/logger.js';
import { createOfficialTraderQueries } from './official-trader.queries.js';
import { createOfficialTraderSettingsService } from './official-trader.settings.service.js';
import { createOfficialTraderResearchService } from './official-trader.research.service.js';
import { createOfficialTraderAnalysisService, toPublicAnalysis } from './official-trader.analysis.service.js';
import { createOfficialTraderExecutionService, toPublicExecution } from './official-trader.execution.service.js';
import { createOfficialTraderPerformanceService } from './official-trader.performance.service.js';
import { createOfficialTraderPlansService } from './official-trader.plans.service.js';
import { createOfficialTraderAdminRoutes } from './official-trader.routes.js';

const ADMIN_ROLE_NAMES = ['platform_administrator', 'platform_operations'];

export function createOfficialTraderModule({ services }) {
  const logger = createLogger({ component: 'official-trader' });
  const queries = createOfficialTraderQueries({ db: services.db });
  const getProvider = () => queries.getProvider();

  const recordEvent = async (data) => {
    try {
      return await queries.insertEvent(data);
    } catch (error) {
      logger.warn({ err: error, eventType: data.eventType }, 'Official trader event could not be stored');
      return null;
    }
  };

  const adminAudit = () => services.modules?.admin?.audit || null;

  const audit = async (params) => {
    const writer = adminAudit();
    try {
      if (writer?.write) {
        return await writer.write({
          actorId: params.actorId,
          action: params.action,
          targetResource: params.targetResource,
          targetId: params.targetId,
          reason: params.reason,
          before: params.before,
          after: params.after,
          outcome: params.outcome,
        });
      }
      if (params.targetResource && params.targetId) {
        return await services.audit.write({
          actorId: params.actorId,
          action: params.action,
          resourceType: params.targetResource,
          resourceId: params.targetId,
          before: params.before,
          after: params.after,
          outcome: params.outcome || 'success',
          metadata: params.reason ? { reason: params.reason } : null,
        });
      }
      return null;
    } catch (error) {
      logger.warn({ err: error, action: params.action }, 'Official trader audit event failed');
      return null;
    }
  };

  const getAudit = () => ({
    write: audit,
  });

  const notifyAdmins = async ({ eventType, title, message, priority = 'normal', action }) => {
    if (!services.notifications?.service?.create) return;
    let recipients = [];
    try {
      const result = await services.db.query(
        `
        SELECT DISTINCT user.id
        FROM admin_user_role_assignments assignment
        JOIN admin_role_definitions role ON role.id = assignment.role_id
        JOIN users account_user ON account_user.id = assignment.user_id
        WHERE assignment.revoked_at IS NULL
          AND role.name = ANY($1::text[])
          AND account_user.status = 'active'
        `,
        [ADMIN_ROLE_NAMES],
      );
      recipients = result.rows.map((row) => row.id);
    } catch (error) {
      logger.warn({ err: error }, 'Could not resolve official trader admin recipients');
      return;
    }
    await Promise.allSettled(
      recipients.map((userId) =>
        services.notifications.service.create({
          userId,
          eventType,
          category: 'official_trader',
          priority,
          title,
          message,
          action: action || null,
        }),
      ),
    );
  };

  const settings = createOfficialTraderSettingsService({
    db: services.db,
    queries,
    connections: services.connections,
    risk: services.risk,
    events: services.events,
    logger,
    getAudit,
    getProvider,
  });

  const research = createOfficialTraderResearchService({
    db: services.db,
    queries,
    connections: services.connections,
    ai: services.ai,
    events: services.events,
    logger,
    getProvider,
    recordEvent,
  });

  const analysis = createOfficialTraderAnalysisService({
    db: services.db,
    queries,
    connections: services.connections,
    risk: services.risk,
    logger,
    getProvider,
    recordEvent,
  });

  const execution = createOfficialTraderExecutionService({
    db: services.db,
    queries,
    terminal: services.terminal,
    marketData: services.connections.marketData,
    analysisService: analysis,
    publication: services.marketplace.publication,
    logger,
    getProvider,
    recordEvent,
    audit,
    notifyAdmins,
  });

  const performance = createOfficialTraderPerformanceService({
    db: services.db,
    queries,
    logger,
    getProvider,
    recordEvent,
    audit,
  });

  const plans = createOfficialTraderPlansService({
    db: services.db,
    queries,
    config: services.config,
    logger,
    getProvider,
    recordEvent,
    audit,
    notifyAdmins,
  });

  const routes = createOfficialTraderAdminRoutes({
    settings,
    research,
    analysis,
    execution,
    performance,
    plans,
    queries,
    getProvider,
    risk: services.risk,
    middleware: services.middleware,
  });

  const publicApi = {
    service: {
      getOverview: () => settings.getOverview(),
      updateSettings: (params) => settings.updateSettings(params),
      connectExchange: (params) => settings.connectExchange(params),
      assignExistingConnection: (params) => settings.assignExistingConnection(params),
      updateConnection: (params) => settings.updateConnection(params),
      removeConnection: (params) => settings.removeConnection(params),
      emergencyPause: (params) => settings.emergencyPause(params),
      resume: (params) => settings.resume(params),
      runResearch: (params) => research.runResearch(params),
      validateAnalysis: (params) => analysis.validateAnalysis(params),
      executeAnalysis: (params) => execution.executeAnalysis(params),
      confirmExecution: (params) => execution.confirmExecution(params),
      syncExecution: (params) => execution.syncExecution(params),
      reconcileNow: (params) => execution.reconcileNow(params),
      listExecutionDetail: (params) => execution.listExecutionDetail(params),
      getPublicPerformance: (params) => performance.getPublicPerformance(params),
      getAdminPerformance: (params) => performance.getAdminPerformance(params),
      createSnapshot: (params) => performance.createSnapshot(params),
    },
    toPublicAnalysis,
    toPublicExecution,
    getPublicPerformance: (params) => performance.getPublicPerformance(params),
    runResearch: (params) => research.runResearch(params),
    reconcileNow: (params) => execution.reconcileNow(params),
  };

  return {
    name: 'officialTrader',
    routes,
    queries,
    settings,
    research,
    analysis,
    execution,
    performance,
    publicApi,

    async shutdown() {
      logger.debug('Official trader module shutdown');
    },
  };
}

export default createOfficialTraderModule;

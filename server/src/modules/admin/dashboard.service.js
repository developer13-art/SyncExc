/**
 * SyncExc Server — Admin dashboard service
 */

export function createDashboardService({ db, queries, logger }) {
  async function getOverview({ timeRange = '24h' } = {}) {
    const since = computeSince(timeRange);

    const users = await queries.countUsers({ since });
    const totalUsers = await queries.countAllUsers();
    const activeWorkspaces = await queries.countActiveWorkspaces();
    const activeExchanges = await queries.countActiveExchanges();
    const platformGrowth = await queries.platformGrowth({ since });
    const recentSignups = await queries.recentSignups({ limit: 6 });
    const activeSubscriptions = await queries.countActiveSubscriptions();
    const subscriptionsByStatus = await queries.subscriptionsByStatus();
    const paymentMetrics = await queries.paymentMetrics({ since });
    const unresolvedRefunds = await queries.unresolvedRefunds();
    const exchangeHealth = await queries.exchangeHealthSummary();
    const syncBacklog = await queries.syncBacklog();
    const sourceReviewBacklog = await queries.sourceReviewBacklog();
    const riskAlertsOpen = await queries.riskAlertsOpen();
    const supportBacklog = await queries.supportBacklog();
    const auditFailures = await queries.auditFailuresCount({ since });

    return {
      timeRange,
      since: since.toISOString(),
      users: { newInRange: users },
      totalUsers,
      activeWorkspaces,
      activeExchanges,
      platformGrowth: platformGrowth.map((row) => ({
        date: row.day,
        newUsers: row.new_users,
        newWorkspaces: row.new_workspaces,
        successfulPayments: row.successful_payments,
      })),
      recentSignups: recentSignups.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        username: row.username,
        avatarUrl: row.avatar_url,
        status: row.status,
        createdAt: row.created_at,
      })),
      subscriptions: {
        active: activeSubscriptions,
        byStatus: subscriptionsByStatus.reduce(
          (acc, r) => ({ ...acc, [r.status]: r.count }),
          {}
        ),
      },
      payments: {
        successful: paymentMetrics.successful,
        failed: paymentMetrics.failed,
        pending: paymentMetrics.pending,
        totalVolumeMinor: paymentMetrics.total_volume_minor,
      },
      refunds: { unresolved: unresolvedRefunds },
      exchangeHealth: exchangeHealth.reduce(
        (acc, r) => ({ ...acc, [r.state]: r.count }),
        {}
      ),
      sync: {
        queued: syncBacklog.queued,
        processing: syncBacklog.processing,
        reconciliationRequired: syncBacklog.reconciliation_required,
      },
      sources: {
        reviewBacklog: sourceReviewBacklog,
      },
      risk: { openAlerts: riskAlertsOpen },
      support: {
        open: supportBacklog.open,
        urgent: supportBacklog.urgent,
      },
      audit: { failures: auditFailures },
    };
  }

  function computeSince(range) {
    const now = Date.now();
    const map = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return new Date(now - (map[range] || map['24h']));
  }

  return {
    getOverview,
  };
}

export default createDashboardService;
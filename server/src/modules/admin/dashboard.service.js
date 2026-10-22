/**
 * SyncExc Server — Admin dashboard service
 */

export function createDashboardService({ db, queries, logger }) {
  async function getOverview({ timeRange = '24h' } = {}) {
    const since = computeSince(timeRange);

    const [
      users,
      totalUsers,
      activeWorkspaces,
      activeExchanges,
      platformGrowth,
      recentSignups,
      tradingVolume,
      exchangeOverview,
      recentActivity,
      topPerformingTraders,
      recentSignals,
      activeSubscriptions,
      subscriptionsByStatus,
      subscriptionPayoutSummary,
      subscriptionsStartedToday,
      paymentMetrics,
      unresolvedRefunds,
      exchangeHealth,
      syncBacklog,
      sourceReviewBacklog,
      riskAlertsOpen,
      supportBacklog,
      auditFailures,
    ] = await Promise.all([
      queries.countUsers({ since }),
      queries.countAllUsers(),
      queries.countActiveWorkspaces(),
      queries.countActiveExchanges(),
      queries.platformGrowth({ since }),
      queries.recentSignups({ limit: 6 }),
      queries.tradingVolume24h(),
      queries.exchangeOverview(),
      queries.recentPlatformActivity({ limit: 6 }),
      queries.topPerformingTraders({ limit: 5 }),
      queries.recentSignals({ limit: 5 }),
      queries.countActiveSubscriptions(),
      queries.subscriptionsByStatus(),
      queries.subscriptionPayoutSummary(),
      queries.subscriptionsStartedToday({ limit: 5 }),
      queries.paymentMetrics({ since }),
      queries.unresolvedRefunds(),
      queries.exchangeHealthSummary(),
      queries.syncBacklog(),
      queries.sourceReviewBacklog(),
      queries.riskAlertsOpen(),
      queries.supportBacklog(),
      queries.auditFailuresCount({ since }),
    ]);

    return {
      timeRange,
      since: since.toISOString(),
      users: { newInRange: users },
      totalUsers,
      activeWorkspaces,
      activeExchanges,
      tradingVolume24h: {
        volume: tradingVolume.volume,
        changePct: Number(tradingVolume.previous_volume) > 0
          ? ((Number(tradingVolume.volume) - Number(tradingVolume.previous_volume)) /
            Number(tradingVolume.previous_volume)) * 100
          : null,
      },
      exchangeOverview: exchangeOverview.map((row) => {
        const current = Number(row.current_balance);
        const prior = Number(row.prior_balance);
        return {
          exchangeCode: row.exchange_code,
          displayName: row.display_name,
          connectionCount: Number(row.connection_count),
          healthyCount: Number(row.healthy_count),
          stablecoinBalanceUsd: Number.isFinite(current) ? current : null,
          stablecoinBalanceChangePct:
            Number.isFinite(current) && Number.isFinite(prior) && prior > 0
              ? ((current - prior) / prior) * 100
              : null,
        };
      }),
      recentActivity: recentActivity.map((row) => ({
        id: row.id,
        occurredAt: row.occurred_at,
        action: row.action,
        detail: row.detail,
        actorName: row.actor_name,
        resourceType: row.resource_type,
      })),
      topPerformingTraders: topPerformingTraders.map((row) => ({
        id: row.id,
        handle: row.handle,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        followers: Number(row.followers),
        winRate: row.win_rate === null ? null : Number(row.win_rate),
      })),
      recentSignals: recentSignals.map((row) => ({
        id: row.id,
        instrument: row.instrument,
        marketType: row.market_type,
        direction: row.direction,
        status: row.status,
        entry: row.entry,
        createdAt: row.created_at,
        sourceName: row.source_name,
        avatarUrl: row.avatar_url,
      })),
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
      subscriptionActivity: {
        payouts: subscriptionPayoutSummary.map((row) => ({
          currency: row.currency,
          successfulCount: Number(row.successful_count),
          totalPaidMinor: row.total_paid_minor,
          paidTodayMinor: row.paid_today_minor,
        })),
        subscribedTodayCount: Number(subscriptionsStartedToday[0]?.today_count) || 0,
        subscribedToday: subscriptionsStartedToday
          .filter((row) => row.id)
          .map((row) => ({
            id: row.id,
            subscriberName: row.subscriber_name,
            avatarUrl: row.avatar_url,
            planName: row.plan_name,
            status: row.status,
            createdAt: row.created_at,
          })),
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
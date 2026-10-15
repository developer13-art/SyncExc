/**
 * SyncExc Server — Affiliate dashboard
 */

export function createDashboardService({ db, queries, ledgerService, logger }) {
  async function getDashboard({ affiliateId, currency = 'USD' }) {
    const affiliate = await queries.findAffiliateById(affiliateId);
    if (!affiliate) return null;

    const links = await queries.listLinksForAffiliate(affiliateId);

    let totalClicks = 0;
    const linkStats = [];
    for (const link of links) {
      const clicks = await queries.countClicksForLink(link.id);
      totalClicks += clicks;
      linkStats.push({
        linkId: link.id,
        code: link.code,
        name: link.name,
        status: link.status,
        clicks,
      });
    }

    const attributions = await queries.listAttributionsForAffiliate(affiliateId, { limit: 100 });
    const attributedCount = attributions.rows.length;
    const convertedCount = attributions.rows.filter((a) => a.state === 'converted').length;

    const accruals = await queries.listAccrualsForAffiliate(affiliateId, { limit: 200 });
    const totalAccruedMinor = accruals
      .filter((a) => a.state !== 'reversed')
      .reduce((sum, a) => sum + Number(a.amount_minor), 0);

    const wallet = await ledgerService.getBalance({ affiliateId, currency });

    const payouts = await queries.listPayoutsForAffiliate(affiliateId, { limit: 50 });
    const totalPaidMinor = payouts
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount_minor), 0);

    return {
      affiliate,
      summary: {
        totalClicks,
        attributedCount,
        convertedCount,
        conversionRate: attributedCount > 0 ? (convertedCount / attributedCount) * 100 : 0,
        totalAccruedMinor,
        totalPaidMinor,
        currency,
        wallet: wallet
          ? {
              availableMinor: Number(wallet.available_minor),
              pendingMinor: Number(wallet.pending_minor),
              paidMinor: Number(wallet.paid_minor),
            }
          : null,
      },
      links: linkStats,
      recentAttributions: attributions.rows.slice(0, 10),
      recentAccruals: accruals.slice(0, 10),
      recentPayouts: payouts.slice(0, 10),
    };
  }

  return {
    getDashboard,
  };
}

export default createDashboardService;
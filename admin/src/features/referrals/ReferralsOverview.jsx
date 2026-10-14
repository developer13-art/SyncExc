import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Coins, TrendingUp, Wallet, Users } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { referralsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';

export default function ReferralsOverview() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Referral Program'));
    dispatch(adminUiActions.setBreadcrumbs([{ label: 'Referrals', path: '/referrals' }]));
  }, [dispatch]);

  const commissionsQuery = useQuery({
    queryKey: ['referrals', 'commissions', 'overview'],
    queryFn: () => referralsApi.commissions({ pageSize: 1 }),
  });

  const payoutsQuery = useQuery({
    queryKey: ['referrals', 'payouts', 'overview'],
    queryFn: () => referralsApi.payouts({ pageSize: 1 }),
  });

  if (commissionsQuery.isLoading || payoutsQuery.isLoading) {
    return <LoadingState label="Loading overview" />;
  }

  const commissions = commissionsQuery.data?.meta?.totals ?? {};
  const payouts = payoutsQuery.data?.meta?.totals ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Referral Program
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Commission policies, ledger, payouts, and fraud controls for the referral program.
            Commissions are based on subscription revenue only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/referrals/policies">Policies</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/referrals/payouts">Payouts</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/referrals/fraud-cases">Fraud cases</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Accrued (period)"
          value={formatCurrency(commissions.accrued ?? 0, 'USD')}
          icon={Coins}
        />
        <StatCard
          label="Payable"
          value={formatCurrency(commissions.payable ?? 0, 'USD')}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Paid (period)"
          value={formatCurrency(payouts.paid ?? 0, 'USD')}
          icon={TrendingUp}
        />
        <StatCard
          label="Reversals"
          value={formatCurrency(commissions.reversals ?? 0, 'USD')}
          icon={Users}
          tone="destructive"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payout status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending review</span>
              <span className="font-medium text-foreground">
                {payouts.pendingReview ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Processing</span>
              <span className="font-medium text-foreground">
                {payouts.processing ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reconciliation required</span>
              <span className="font-medium text-foreground">
                {payouts.reconciliationRequired ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fraud signals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Open cases</span>
              <span className="font-medium text-foreground">
                {commissions.openFraudCases ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Under review</span>
              <span className="font-medium text-foreground">
                {commissions.casesUnderReview ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Confirmed abuse (period)</span>
              <span className="font-medium text-destructive">
                {commissions.confirmedAbuse ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Commissions are never based on trading volume, losses, or exchange account balances.
          Only direct referrals are rewarded — there is no multi-level structure.
        </CardContent>
      </Card>
    </div>
  );
}
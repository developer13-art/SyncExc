import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Coins } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { useReferralProfile } from '../../hooks/useReferrals.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Enroll() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const profileQuery = useReferralProfile();

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Enroll in Referral Program'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
        { label: 'Enroll', path: ROUTES.app.referral.enroll },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async () => {
    if (!accepted) {
      toast.error('Please accept the terms');
      return;
    }
    setSubmitting(true);
    try {
      await profileQuery.enroll({
        agreementAcceptedAt: new Date().toISOString(),
      });
      toast.success('Enrolled', {
        description: 'You can now create referral links.',
      });
      navigate(ROUTES.app.referral.dashboard, { replace: true });
    } catch (err) {
      toast.error('Enrollment failed', { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.referral.dashboard}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Join the Referral Program
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Earn commissions from qualifying subscription payments made by users you refer.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Point>Create referral links and share them with eligible users.</Point>
            <Point>When they subscribe, we attribute the referral server-side.</Point>
            <Point>
              Commissions accrue from qualifying subscription payments only — never from
              trading volume, losses, or account balances.
            </Point>
            <Point>
              Track earnings, request payouts, and review statements in your dashboard.
            </Point>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Program rules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
            <Rule>Only direct referrals are rewarded. There is no multi-level structure.</Rule>
            <Rule>
              Referrals must be attributed under the published attribution policy and window.
            </Rule>
            <Rule>
              Self-referrals, duplicate accounts, click manipulation, and payout abuse are
              prohibited and reviewed.
            </Rule>
            <Rule>
              Refunds and chargebacks create linked ledger adjustments — previous earnings
              aren't rewritten.
            </Rule>
            <Rule>
              Payouts require eligibility, fraud screening, and provider confirmation.
            </Rule>
            <Rule>
              We reserve the right to update program terms prospectively with notice.
            </Rule>
          </CardContent>
        </Card>

        <Alert variant="info" className="mt-4" title="No trading-based rewards">
          <p className="text-xs">
            SyncExc commission rewards are based on subscription revenue, not on any user's
            trading activity, volume, leverage, liquidation events, or balances.
          </p>
        </Alert>

        <label className="mt-6 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <span className="text-muted-foreground">
            I have read and accept the referral program terms and rules.
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.referral.dashboard}>Cancel</Link>
          </Button>
          <Button onClick={handleSubmit} disabled={!accepted || submitting}>
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? 'Enrolling…' : 'Enroll'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Point({ children }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function Rule({ children }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
      <span>{children}</span>
    </div>
  );
}
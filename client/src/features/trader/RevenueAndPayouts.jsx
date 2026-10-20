import { CircleDollarSign } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';

export default function RevenueAndPayouts() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Revenue & payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Payment reporting and payout requests for this Trader workspace.</p>
      </header>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle>Payments are not connected</CardTitle>
              <CardDescription>Revenue and payouts are unavailable right now.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Marketplace billing and payout processing have not been implemented, so SyncExc does not report balances, estimate earnings, or accept payout requests. Your profile and signal publishing are separate from payments.
        </CardContent>
      </Card>
    </div>
  );
}

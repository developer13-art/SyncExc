import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { format } from 'date-fns';
import { DollarSign } from 'lucide-react';

export default function RevenueAndPayouts() {
  const { data: revenue, isLoading } = useQuery({
    queryKey: ['provider-revenue'],
    queryFn: () => api.get('/marketplace/provider/revenue').then(res => res.data.data),
  });

  if (isLoading) return <div className="p-8">Loading revenue data...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Revenue & Payouts</h1>
        <p className="text-muted-foreground mt-1">Track your earnings and request payouts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm font-medium text-muted-foreground">Available Balance</p>
          <p className="text-3xl font-bold mt-2 text-emerald-500">${revenue?.availableBalance || '0.00'}</p>
          <button className="mt-4 w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:bg-primary/90">Request Payout</button>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm font-medium text-muted-foreground">Pending Clearance</p>
          <p className="text-3xl font-bold mt-2">${revenue?.pendingBalance || '0.00'}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm font-medium text-muted-foreground">Total Earned (All Time)</p>
          <p className="text-3xl font-bold mt-2">${revenue?.totalEarned || '0.00'}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold">Payout History</h2>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Amount</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Transaction ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {revenue?.payouts?.map((payout) => (
              <tr key={payout.id} className="hover:bg-muted/50">
                <td className="px-6 py-4">{format(new Date(payout.createdAt), 'MMM d, yyyy')}</td>
                <td className="px-6 py-4 font-medium">${payout.amount.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-medium">
                    {payout.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{payout.txId || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { format } from 'date-fns';

export default function SignalHistory() {
  const { data: signals, isLoading } = useQuery({
    queryKey: ['provider-signals'],
    queryFn: () => api.get('/marketplace/signals/history').then(res => res.data.data),
  });

  if (isLoading) return <div className="p-8">Loading signals...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Signal History</h1>
        <p className="text-muted-foreground mt-1">All signals you have published to your subscribers.</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Instrument</th>
              <th className="px-6 py-3 font-medium">Direction</th>
              <th className="px-6 py-3 font-medium">Entry</th>
              <th className="px-6 py-3 font-medium">Targets</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {signals?.map((sig) => (
              <tr key={sig.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4">{format(new Date(sig.createdAt), 'MMM d, yyyy HH:mm')}</td>
                <td className="px-6 py-4 font-medium">{sig.instrument}</td>
                <td className={`px-6 py-4 font-medium ${sig.direction === 'Long' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {sig.direction}
                </td>
                <td className="px-6 py-4">{sig.entry}</td>
                <td className="px-6 py-4">{sig.targets?.join(', ')}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    sig.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {sig.status}
                  </span>
                </td>
              </tr>
            ))}
            {signals?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No signals published yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
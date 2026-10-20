import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { format } from 'date-fns';

export default function SubscribersList() {
  const { data: subscribers, isLoading } = useQuery({
    queryKey: ['provider-subscribers'],
    queryFn: () => api.get('/marketplace/provider/subscribers').then(res => res.data.data),
  });

  if (isLoading) return <div className="p-8">Loading subscribers...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscribers</h1>
        <p className="text-muted-foreground mt-1">Users currently subscribed to your signals.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subscribers?.map((sub) => (
          <div key={sub.id} className="bg-card border border-border rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold">{sub.user.displayName}</h3>
                <p className="text-sm text-muted-foreground">@{sub.user.username}</p>
              </div>
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-medium rounded-full">Active</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span>{format(new Date(sub.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{sub.planName}</span>
              </div>
            </div>
          </div>
        ))}
        {subscribers?.length === 0 && (
          <div className="col-span-3 text-center py-12 text-muted-foreground">
            No active subscribers yet.
          </div>
        )}
      </div>
    </div>
  );
}
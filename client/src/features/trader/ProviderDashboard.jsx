import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { Users, Send, DollarSign, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProviderDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['provider-stats'],
    queryFn: () => api.get('/marketplace/provider/dashboard').then(res => res.data.data),
  });

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Provider Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your signals, subscribers, and revenue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Active Subscribers" value={stats?.activeSubscribers || 0} icon={Users} trend="+12% this month" />
        <StatCard title="Signals Published" value={stats?.totalSignals || 0} icon={Send} />
        <StatCard title="Est. Monthly Revenue" value={`$${stats?.monthlyRevenue || '0.00'}`} icon={DollarSign} trend="+5% this week" />
        <StatCard title="Win Rate (30d)" value={`${stats?.winRate || 0}%`} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.revenueHistory || []}>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} tickFormatter={(value) => `$${value}`} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {stats?.recentActivity?.map((act, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium">{act.title}</p>
                  <p className="text-xs text-muted-foreground">{act.time}</p>
                </div>
              </div>
            )) || <p className="text-sm text-muted-foreground">No recent activity.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && <p className="text-xs text-emerald-500 mt-2 font-medium">{trend}</p>}
    </div>
  );
}
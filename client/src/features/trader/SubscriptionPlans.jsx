import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { Plus, Check } from 'lucide-react';

export default function SubscriptionPlans() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', price: '', features: '' });

  const { data: plans, isLoading } = useQuery({
    queryKey: ['provider-plans'],
    queryFn: () => api.get('/marketplace/provider/plans').then(res => res.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (plan) => api.post('/marketplace/provider/plans', plan),
    onSuccess: () => {
      queryClient.invalidateQueries(['provider-plans']);
      setIsCreating(false);
      setNewPlan({ name: '', price: '', features: '' });
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    createMutation.mutate({
      name: newPlan.name,
      price: parseFloat(newPlan.price),
      features: newPlan.features.split(',').map(f => f.trim())
    });
  };

  if (isLoading) return <div className="p-8">Loading plans...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground mt-1">Manage the tiers your subscribers can purchase.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Create Plan
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-card border border-border p-6 rounded-xl space-y-4">
          <h3 className="font-semibold text-lg">Create New Plan</h3>
          <div className="grid grid-cols-2 gap-4">
            <input required placeholder="Plan Name (e.g. VIP)" className="bg-background border border-border rounded-md px-3 py-2" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} />
            <input required type="number" step="0.01" placeholder="Price (USD/month)" className="bg-background border border-border rounded-md px-3 py-2" value={newPlan.price} onChange={e => setNewPlan({...newPlan, price: e.target.value})} />
          </div>
          <input required placeholder="Features (comma separated)" className="w-full bg-background border border-border rounded-md px-3 py-2" value={newPlan.features} onChange={e => setNewPlan({...newPlan, features: e.target.value})} />
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending} className="bg-primary text-primary-foreground px-4 py-2 rounded-md">Save Plan</button>
            <button type="button" onClick={() => setIsCreating(false)} className="bg-muted text-muted-foreground px-4 py-2 rounded-md">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan) => (
          <div key={plan.id} className="bg-card border border-border rounded-xl p-6 relative">
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="text-3xl font-bold mt-2">${plan.price}<span className="text-sm text-muted-foreground font-normal">/mo</span></p>
            <ul className="mt-4 space-y-2 text-sm">
              {plan.features?.map((f, i) => (
                <li key={i} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
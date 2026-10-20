import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

export default function PublishSignal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    instrument: '', direction: 'Long', entry: '', stopLoss: '', targets: '', notes: ''
  });

  const mutation = useMutation({
    mutationFn: (newSignal) => api.post('/marketplace/signals/publish', newSignal),
    onSuccess: () => {
      queryClient.invalidateQueries(['provider-signals']);
      navigate('/trader/signals/history');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      targets: formData.targets.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t)),
      entry: parseFloat(formData.entry),
      stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : null,
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Publish New Signal</h1>
      
      {mutation.isError && (
        <div className="mb-6 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{mutation.error?.response?.data?.error?.message || 'Failed to publish signal.'}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-card border border-border p-6 rounded-xl shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Instrument (e.g., BTCUSDT)</label>
            <input required className="w-full bg-background border border-border rounded-md px-3 py-2" value={formData.instrument} onChange={e => setFormData({...formData, instrument: e.target.value.toUpperCase()})} placeholder="BTCUSDT" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Direction</label>
            <select className="w-full bg-background border border-border rounded-md px-3 py-2" value={formData.direction} onChange={e => setFormData({...formData, direction: e.target.value})}>
              <option value="Long">Long (Buy)</option>
              <option value="Short">Short (Sell)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Entry Price</label>
            <input type="number" step="any" required className="w-full bg-background border border-border rounded-md px-3 py-2" value={formData.entry} onChange={e => setFormData({...formData, entry: e.target.value})} placeholder="60000" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Stop Loss (Optional)</label>
            <input type="number" step="any" className="w-full bg-background border border-border rounded-md px-3 py-2" value={formData.stopLoss} onChange={e => setFormData({...formData, stopLoss: e.target.value})} placeholder="59000" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Take Profit Targets (Comma separated)</label>
          <input required placeholder="e.g. 65000, 66000, 68000" className="w-full bg-background border border-border rounded-md px-3 py-2" value={formData.targets} onChange={e => setFormData({...formData, targets: e.target.value})} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Notes / Analysis (Optional)</label>
          <textarea rows={4} className="w-full bg-background border border-border rounded-md px-3 py-2" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Add context or chart analysis here..." />
        </div>

        <button type="submit" disabled={mutation.isPending} className="w-full bg-primary text-primary-foreground py-2 rounded-md font-medium hover:bg-primary/90 transition-colors">
          {mutation.isPending ? 'Publishing...' : 'Publish Signal to Subscribers'}
        </button>
      </form>
    </div>
  );
}
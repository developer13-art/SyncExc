import { Route, Routes, Navigate } from 'react-router-dom';
import ProviderDashboard from '../features/trader/ProviderDashboard';
import PublishSignal from '../features/trader/PublishSignal';
import SignalHistory from '../features/trader/SignalHistory';
import SubscribersList from '../features/trader/SubscribersList';
import SubscriptionPlans from '../features/trader/SubscriptionPlans';
import RevenueAndPayouts from '../features/trader/RevenueAndPayouts';

export default function TraderRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<ProviderDashboard />} />
      <Route path="signals/publish" element={<PublishSignal />} />
      <Route path="signals/history" element={<SignalHistory />} />
      <Route path="subscribers" element={<SubscribersList />} />
      <Route path="plans" element={<SubscriptionPlans />} />
      <Route path="revenue" element={<RevenueAndPayouts />} />
    </Routes>
  );
}
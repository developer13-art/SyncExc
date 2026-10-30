import { Route, Routes, Navigate } from 'react-router-dom';
import ProviderDashboard from '../features/trader/ProviderDashboard';
import PublishSignal from '../features/trader/PublishSignal';
import SignalHistory from '../features/trader/SignalHistory';
import SubscribersList from '../features/trader/SubscribersList';
import SubscriptionPlans from '../features/trader/SubscriptionPlans';
import RevenueAndPayouts from '../features/trader/RevenueAndPayouts';
import TraderProfile from '../features/marketplace/TraderProfile';
import CreateStrategyListing from '../features/marketplace/CreateStrategyListing';

export default function TraderRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<ProviderDashboard />} />
      <Route path="marketplace" element={<ProviderDashboard />} />
      <Route path="listings/new" element={<CreateStrategyListing />} />
      <Route path="signals/publish" element={<PublishSignal />} />
      <Route path="signals/history" element={<SignalHistory />} />
      <Route path="subscribers" element={<SubscribersList />} />
      <Route path="plans" element={<SubscriptionPlans />} />
      <Route path="revenue" element={<RevenueAndPayouts />} />
      <Route path="profile" element={<TraderProfile />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ConsoleLayout } from '../layouts/ConsoleLayout.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { NotFoundRoute } from './NotFoundRoute.jsx';

const Overview = lazy(() => import('../features/overview/PlatformOverview.jsx'));
const UsersList = lazy(() => import('../features/users/UsersList.jsx'));
const UserDetails = lazy(() => import('../features/users/UserDetails.jsx'));
const WorkspacesList = lazy(() => import('../features/workspaces/WorkspacesList.jsx'));
const WorkspaceDetails = lazy(() => import('../features/workspaces/WorkspaceDetails.jsx'));

const PlansList = lazy(() => import('../features/plans/PlansList.jsx'));
const CreatePlan = lazy(() => import('../features/plans/CreatePlan.jsx'));
const PlanEditor = lazy(() => import('../features/plans/PlanEditor.jsx'));

const SubscriptionsList = lazy(() => import('../features/subscriptions/SubscriptionsList.jsx'));
const SubscriptionDetails = lazy(() => import('../features/subscriptions/SubscriptionDetails.jsx'));

const PaymentsList = lazy(() => import('../features/payments/PaymentsList.jsx'));
const PaymentDetails = lazy(() => import('../features/payments/PaymentDetails.jsx'));

const RefundsList = lazy(() => import('../features/refunds/RefundsList.jsx'));
const RefundDetails = lazy(() => import('../features/refunds/RefundDetails.jsx'));

const ExchangesList = lazy(() => import('../features/exchanges/ExchangesList.jsx'));
const ExchangeDetails = lazy(() => import('../features/exchanges/ExchangeDetails.jsx'));

const CandidatesList = lazy(() => import('../features/source-discovery/CandidatesList.jsx'));
const CandidateDetails = lazy(() => import('../features/source-discovery/CandidateDetails.jsx'));

const SourcesList = lazy(() => import('../features/signal-sources/SourcesList.jsx'));
const SourceDetails = lazy(() => import('../features/signal-sources/SourceDetails.jsx'));

const ReferralsOverview = lazy(() => import('../features/referrals/ReferralsOverview.jsx'));
const ReferralPolicies = lazy(() => import('../features/referrals/Policies.jsx'));
const ReferralPayouts = lazy(() => import('../features/referrals/Payouts.jsx'));
const ReferralFraudCases = lazy(() => import('../features/referrals/FraudCases.jsx'));

const SupportOverview = lazy(() => import('../features/support/SupportOverview.jsx'));
const SupportQueues = lazy(() => import('../features/support/Queues.jsx'));
const SupportMetrics = lazy(() => import('../features/support/SupportMetrics.jsx'));

const FlagsList = lazy(() => import('../features/feature-flags/FlagsList.jsx'));
const CreateFlag = lazy(() => import('../features/feature-flags/CreateFlag.jsx'));
const FlagEditor = lazy(() => import('../features/feature-flags/FlagEditor.jsx'));
const FlagVersions = lazy(() => import('../features/feature-flags/FlagVersions.jsx'));
const FlagRollouts = lazy(() => import('../features/feature-flags/FlagRollouts.jsx'));

const RolesList = lazy(() => import('../features/roles/RolesList.jsx'));
const RoleEditor = lazy(() => import('../features/roles/RoleEditor.jsx'));

const ApprovalsList = lazy(() => import('../features/approvals/ApprovalsList.jsx'));

const AuditList = lazy(() => import('../features/audit/AuditList.jsx'));
const AuditDetails = lazy(() => import('../features/audit/AuditDetails.jsx'));

const AlertRules = lazy(() => import('../features/alerts/AlertRules.jsx'));
const AlertEvents = lazy(() => import('../features/alerts/AlertEvents.jsx'));

const JobsList = lazy(() => import('../features/operation-jobs/JobsList.jsx'));
const JobDetails = lazy(() => import('../features/operation-jobs/JobDetails.jsx'));

function Fallback({ children }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export function ConsoleRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ConsoleLayout />}>
        <Route index element={<Navigate to="overview" replace />} />

        <Route path="overview" element={<Fallback><Overview /></Fallback>} />

        <Route path="users" element={<Fallback><UsersList /></Fallback>} />
        <Route path="users/:userId" element={<Fallback><UserDetails /></Fallback>} />

        <Route path="workspaces" element={<Fallback><WorkspacesList /></Fallback>} />
        <Route path="workspaces/:workspaceId" element={<Fallback><WorkspaceDetails /></Fallback>} />

        <Route path="plans" element={<Fallback><PlansList /></Fallback>} />
        <Route path="plans/new" element={<Fallback><CreatePlan /></Fallback>} />
        <Route path="plans/:planId" element={<Fallback><PlanEditor /></Fallback>} />

        <Route path="subscriptions" element={<Fallback><SubscriptionsList /></Fallback>} />
        <Route
          path="subscriptions/:subscriptionId"
          element={<Fallback><SubscriptionDetails /></Fallback>}
        />

        <Route path="payments" element={<Fallback><PaymentsList /></Fallback>} />
        <Route path="payments/:paymentId" element={<Fallback><PaymentDetails /></Fallback>} />

        <Route path="refunds" element={<Fallback><RefundsList /></Fallback>} />
        <Route path="refunds/:refundId" element={<Fallback><RefundDetails /></Fallback>} />

        <Route path="exchanges" element={<Fallback><ExchangesList /></Fallback>} />
        <Route
          path="exchanges/:exchangeId"
          element={<Fallback><ExchangeDetails /></Fallback>}
        />

        <Route
          path="source-discovery"
          element={<Fallback><CandidatesList /></Fallback>}
        />
        <Route
          path="source-discovery/:candidateId"
          element={<Fallback><CandidateDetails /></Fallback>}
        />

        <Route path="signal-sources" element={<Fallback><SourcesList /></Fallback>} />
        <Route
          path="signal-sources/:sourceId"
          element={<Fallback><SourceDetails /></Fallback>}
        />

        <Route path="referrals" element={<Fallback><ReferralsOverview /></Fallback>} />
        <Route path="referrals/policies" element={<Fallback><ReferralPolicies /></Fallback>} />
        <Route path="referrals/payouts" element={<Fallback><ReferralPayouts /></Fallback>} />
        <Route path="referrals/fraud" element={<Fallback><ReferralFraudCases /></Fallback>} />

        <Route path="support" element={<Fallback><SupportOverview /></Fallback>} />
        <Route path="support/queues" element={<Fallback><SupportQueues /></Fallback>} />
        <Route path="support/metrics" element={<Fallback><SupportMetrics /></Fallback>} />

        <Route path="feature-flags" element={<Fallback><FlagsList /></Fallback>} />
        <Route path="feature-flags/new" element={<Fallback><CreateFlag /></Fallback>} />
        <Route path="feature-flags/:flagId" element={<Fallback><FlagEditor /></Fallback>} />
        <Route
          path="feature-flags/:flagId/versions"
          element={<Fallback><FlagVersions /></Fallback>}
        />
        <Route
          path="feature-flags/:flagId/rollouts"
          element={<Fallback><FlagRollouts /></Fallback>}
        />

        <Route path="roles" element={<Fallback><RolesList /></Fallback>} />
        <Route path="roles/:roleId" element={<Fallback><RoleEditor /></Fallback>} />

        <Route path="approvals" element={<Fallback><ApprovalsList /></Fallback>} />

        <Route path="audit" element={<Fallback><AuditList /></Fallback>} />
        <Route path="audit/:eventId" element={<Fallback><AuditDetails /></Fallback>} />

        <Route path="alerts/rules" element={<Fallback><AlertRules /></Fallback>} />
        <Route path="alerts/events" element={<Fallback><AlertEvents /></Fallback>} />

        <Route path="operation-jobs" element={<Fallback><JobsList /></Fallback>} />
        <Route
          path="operation-jobs/:jobId"
          element={<Fallback><JobDetails /></Fallback>}
        />

        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}
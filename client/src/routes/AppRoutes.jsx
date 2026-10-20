import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '../layouts/AppLayout.jsx';
import { LoadingState } from '../components/ui/LoadingState.jsx';
import { ROUTES } from '../config/routes.config.js';
import { WorkspaceRouteGuard } from '../app/router.jsx';
import { NotFoundRoute } from './NotFoundRoute.jsx';

const Dashboard = lazy(() => import('../features/dashboard/DashboardOverview.jsx'));
const Terminal = lazy(() => import('../features/terminal/TerminalOverview.jsx'));
const Connections = lazy(() => import('../features/connections/ConnectionsOverview.jsx'));
const ConnectExchange = lazy(() => import('../features/connections/ConnectExchange.jsx'));
const ConnectionDetails = lazy(() => import('../features/connections/ConnectionDetails.jsx'));
const CredentialRotation = lazy(() => import('../features/connections/CredentialRotation.jsx'));
const Sync = lazy(() => import('../features/synchronization/SyncOverview.jsx'));
const CreateSyncGroup = lazy(() => import('../features/synchronization/CreateSyncGroup.jsx'));
const Risk = lazy(() => import('../features/risk/RiskOverview.jsx'));
const Sources = lazy(() => import('../features/sources/SourcesOverview.jsx'));
const AddSource = lazy(() => import('../features/sources/AddSource.jsx'));
const Signals = lazy(() => import('../features/signals/SignalsOverview.jsx'));
const Marketplace = lazy(() => import('../features/marketplace/BrowseProviders.jsx'));
const TraderProfile = lazy(() => import('../features/marketplace/TraderProfile.jsx'));
const TraderRoutes = lazy(() => import('./TraderRoutes.jsx'));
const Automation = lazy(() => import('../features/automation/WorkflowsOverview.jsx'));
const WorkflowTemplates = lazy(() => import('../features/automation/Templates.jsx'));
const CreateWorkflow = lazy(() => import('../features/automation/CreateWorkflow.jsx'));
const WorkflowDetails = lazy(() => import('../features/automation/WorkflowDetails.jsx'));
const WorkflowBuilder = lazy(() => import('../features/automation/WorkflowBuilder.jsx'));
const Simulation = lazy(() => import('../features/simulation/Environments.jsx'));
const CreateEnvironment = lazy(() => import('../features/simulation/CreateEnvironment.jsx'));
const Developer = lazy(() => import('../features/developer/ApplicationsOverview.jsx'));
const Community = lazy(() => import('../features/community/Feed.jsx'));
const Referral = lazy(() => import('../features/referral/ReferralDashboard.jsx'));
const Billing = lazy(() => import('../features/billing/Plans.jsx'));
const Support = lazy(() => import('../features/support/SupportCenter.jsx'));
const Notifications = lazy(() => import('../features/notifications/NotificationCenter.jsx'));
const Settings = lazy(() => import('../features/settings/ProfileSettings.jsx'));
const SettingsOverview = lazy(() => import('../features/settings/SettingsOverview.jsx'));
const PreferencesSettings = lazy(() => import('../features/settings/PreferencesSettings.jsx'));
const TradingPreferences = lazy(() => import('../features/settings/TradingPreferences.jsx'));
const SecuritySettings = lazy(() => import('../features/settings/SecuritySettings.jsx'));
const Sessions = lazy(() => import('../features/settings/Sessions.jsx'));
const TrustedDevices = lazy(() => import('../features/settings/TrustedDevices.jsx'));
const NotificationSettings = lazy(() => import('../features/settings/NotificationSettings.jsx'));
const WorkspaceManagement = lazy(() => import('../features/settings/WorkspaceManagement.jsx'));
const WorkspaceSettings = lazy(() => import('../features/settings/WorkspaceSettings.jsx'));
const WorkspaceMembers = lazy(() => import('../features/settings/WorkspaceMembers.jsx'));
const WorkspaceInvitations = lazy(() => import('../features/settings/WorkspaceInvitations.jsx'));
const WorkspaceRoles = lazy(() => import('../features/settings/WorkspaceRoles.jsx'));
const WorkspaceShares = lazy(() => import('../features/settings/WorkspaceShares.jsx'));
const WorkspaceOwnership = lazy(() => import('../features/settings/WorkspaceOwnership.jsx'));
const WorkspaceAudit = lazy(() => import('../features/settings/WorkspaceAudit.jsx'));

function Fallback({ children }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/app" element={<AppLayout />}>
        <Route element={<WorkspaceRouteGuard />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={<Fallback><Dashboard /></Fallback>}
        />
        <Route path="terminal/*" element={<Fallback><Terminal /></Fallback>} />
        <Route path="connections/new" element={<Fallback><ConnectExchange /></Fallback>} />
        <Route
          path="connections/:connectionId/rotate"
          element={<Fallback><CredentialRotation /></Fallback>}
        />
        <Route
          path="connections/:connectionId"
          element={<Fallback><ConnectionDetails /></Fallback>}
        />
        <Route path="connections/*" element={<Fallback><Connections /></Fallback>} />
        <Route path="synchronization/new" element={<Fallback><CreateSyncGroup /></Fallback>} />
        <Route path="synchronization/*" element={<Fallback><Sync /></Fallback>} />
        <Route path="risk/*" element={<Fallback><Risk /></Fallback>} />
        <Route path="sources/new" element={<Fallback><AddSource /></Fallback>} />
        <Route path="sources/*" element={<Fallback><Sources /></Fallback>} />
        <Route path="signals/*" element={<Fallback><Signals /></Fallback>} />
        <Route path="marketplace/profile" element={<Fallback><TraderProfile /></Fallback>} />
        <Route path="marketplace/*" element={<Fallback><Marketplace /></Fallback>} />
        <Route path="trader/*" element={<Fallback><TraderRoutes /></Fallback>} />
        <Route path="automation/templates" element={<Fallback><WorkflowTemplates /></Fallback>} />
        <Route path="automation/new" element={<Fallback><CreateWorkflow /></Fallback>} />
        <Route path="automation/:workflowId/edit" element={<Fallback><WorkflowBuilder /></Fallback>} />
        <Route path="automation/:workflowId" element={<Fallback><WorkflowDetails /></Fallback>} />
        <Route path="automation/*" element={<Fallback><Automation /></Fallback>} />
        <Route path="simulation/environments/new" element={<Fallback><CreateEnvironment /></Fallback>} />
        <Route path="simulation/*" element={<Fallback><Simulation /></Fallback>} />
        <Route path="developer/*" element={<Fallback><Developer /></Fallback>} />
        <Route path="community/*" element={<Fallback><Community /></Fallback>} />
        <Route path="referral/*" element={<Fallback><Referral /></Fallback>} />
        <Route path="billing/*" element={<Fallback><Billing /></Fallback>} />
        <Route path="support/*" element={<Fallback><Support /></Fallback>} />
        <Route path="notifications/*" element={<Fallback><Notifications /></Fallback>} />
        <Route path="settings" element={<Fallback><SettingsOverview /></Fallback>} />
        <Route path="settings/profile" element={<Fallback><Settings /></Fallback>} />
        <Route path="settings/preferences" element={<Fallback><PreferencesSettings /></Fallback>} />
        <Route path="settings/trading" element={<Fallback><TradingPreferences /></Fallback>} />
        <Route path="settings/security" element={<Fallback><SecuritySettings /></Fallback>} />
        <Route path="settings/sessions" element={<Fallback><Sessions /></Fallback>} />
        <Route path="settings/devices" element={<Fallback><TrustedDevices /></Fallback>} />
        <Route path="settings/notifications" element={<Fallback><NotificationSettings /></Fallback>} />
        <Route path="settings/workspaces" element={<Fallback><WorkspaceManagement /></Fallback>} />
        <Route path="settings/workspaces/new" element={<Fallback><WorkspaceManagement /></Fallback>} />
        <Route path="settings/workspaces/:workspaceId/members" element={<Fallback><WorkspaceMembers /></Fallback>} />
        <Route path="settings/workspaces/:workspaceId/invitations" element={<Fallback><WorkspaceInvitations /></Fallback>} />
        <Route path="settings/workspaces/:workspaceId/roles" element={<Fallback><WorkspaceRoles /></Fallback>} />
        <Route path="settings/workspaces/:workspaceId/connection-shares" element={<Fallback><WorkspaceShares /></Fallback>} />
        <Route path="settings/workspaces/:workspaceId/ownership" element={<Fallback><WorkspaceOwnership /></Fallback>} />
        <Route path="settings/workspaces/:workspaceId/audit" element={<Fallback><WorkspaceAudit /></Fallback>} />
        <Route path="settings/workspaces/:workspaceId" element={<Fallback><WorkspaceSettings /></Fallback>} />
        <Route path="settings/*" element={<Fallback><SettingsOverview /></Fallback>} />
        <Route path="*" element={<NotFoundRoute />} />
        </Route>
      </Route>
    </Routes>
  );
}
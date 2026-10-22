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
const SourceDetails = lazy(() => import('../features/sources/SourceDetails.jsx'));
const AddSource = lazy(() => import('../features/sources/AddSource.jsx'));
const Signals = lazy(() => import('../features/signals/SignalsOverview.jsx'));
const Marketplace = lazy(() => import('../features/marketplace/BrowseProviders.jsx'));
const TraderProfile = lazy(() => import('../features/marketplace/TraderProfile.jsx'));
const ProviderProfile = lazy(() => import('../features/marketplace/ProviderProfile.jsx'));
const Following = lazy(() => import('../features/marketplace/Following.jsx'));
const Subscriptions = lazy(() => import('../features/marketplace/Subscriptions.jsx'));
const CopyConfigurations = lazy(() => import('../features/marketplace/CopyConfigurations.jsx'));
const CreateCopyConfiguration = lazy(() => import('../features/marketplace/CreateCopyConfiguration.jsx'));
const CopyConfigurationDetails = lazy(() => import('../features/marketplace/CopyConfigurationDetails.jsx'));
const CopyResults = lazy(() => import('../features/marketplace/CopyResults.jsx'));
const TraderRoutes = lazy(() => import('./TraderRoutes.jsx'));
const Automation = lazy(() => import('../features/automation/WorkflowsOverview.jsx'));
const WorkflowTemplates = lazy(() => import('../features/automation/Templates.jsx'));
const CreateWorkflow = lazy(() => import('../features/automation/CreateWorkflow.jsx'));
const WorkflowDetails = lazy(() => import('../features/automation/WorkflowDetails.jsx'));
const WorkflowBuilder = lazy(() => import('../features/automation/WorkflowBuilder.jsx'));
const Simulation = lazy(() => import('../features/simulation/Environments.jsx'));
const CreateEnvironment = lazy(() => import('../features/simulation/CreateEnvironment.jsx'));
const Developer = lazy(() => import('../features/developer/ApplicationsOverview.jsx'));
const CommunityFeed = lazy(() => import('../features/community/Feed.jsx'));
const CommunityLayout = lazy(() => import('../features/community/CommunityLayout.jsx'));
const CommunityDiscover = lazy(() => import('../features/community/Discover.jsx'));
const CommunityMyProfile = lazy(() => import('../features/community/MyProfile.jsx'));
const CommunityUserProfile = lazy(() => import('../features/community/UserProfile.jsx'));
const CommunityCreatePost = lazy(() => import('../features/community/CreatePost.jsx'));
const CommunityPostDetails = lazy(() => import('../features/community/PostDetails.jsx'));
const CommunityGroups = lazy(() => import('../features/community/Groups.jsx'));
const CommunityCreateGroup = lazy(() => import('../features/community/CreateGroup.jsx'));
const CommunityGroupDetails = lazy(() => import('../features/community/GroupDetails.jsx'));
const CommunityGroupSettings = lazy(() => import('../features/community/GroupSettings.jsx'));
const CommunityAnalysis = lazy(() => import('../features/community/AnalysisDocuments.jsx'));
const CommunityCreateAnalysis = lazy(() => import('../features/community/CreateAnalysis.jsx'));
const CommunityAnalysisDetails = lazy(() => import('../features/community/AnalysisDetails.jsx'));
const CommunityAnalysisVersions = lazy(() => import('../features/community/AnalysisVersions.jsx'));
const CommunitySaved = lazy(() => import('../features/community/Saved.jsx'));
const CommunityRecommendations = lazy(() => import('../features/community/Recommendations.jsx'));
const CommunityDiscussions = lazy(() => import('../features/community/Discussions.jsx'));
const CommunityMessages = lazy(() => import('../features/community/Messages.jsx'));
const CommunityModerationCenter = lazy(() => import('../features/community/ModerationCenter.jsx'));
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
        <Route path="sources/:sourceId" element={<Fallback><SourceDetails /></Fallback>} />
        <Route path="sources/*" element={<Fallback><Sources /></Fallback>} />
        <Route path="signals/*" element={<Fallback><Signals /></Fallback>} />
        <Route path="marketplace/profile" element={<Fallback><TraderProfile /></Fallback>} />
        <Route path="marketplace/providers/:providerId" element={<Fallback><ProviderProfile /></Fallback>} />
        <Route path="marketplace/copy-configurations/new" element={<Fallback><CreateCopyConfiguration /></Fallback>} />
        <Route path="marketplace/copy-configurations/:configId" element={<Fallback><CopyConfigurationDetails /></Fallback>} />
        <Route path="marketplace/copy-configurations" element={<Fallback><CopyConfigurations /></Fallback>} />
        <Route path="marketplace/following" element={<Fallback><Following /></Fallback>} />
        <Route path="marketplace/subscriptions" element={<Fallback><Subscriptions /></Fallback>} />
        <Route path="marketplace/results" element={<Fallback><CopyResults /></Fallback>} />
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
        <Route element={<Fallback><CommunityLayout /></Fallback>}>
          <Route path="community" element={<Fallback><CommunityFeed /></Fallback>} />
          <Route path="community/feed" element={<Fallback><CommunityFeed /></Fallback>} />
          <Route path="community/discover" element={<Fallback><CommunityDiscover /></Fallback>} />
          <Route path="community/profile" element={<Fallback><CommunityMyProfile /></Fallback>} />
          <Route path="community/profile/:userId" element={<Fallback><CommunityUserProfile /></Fallback>} />
          <Route path="community/posts/new" element={<Fallback><CommunityCreatePost /></Fallback>} />
          <Route path="community/posts/:postId" element={<Fallback><CommunityPostDetails /></Fallback>} />
          <Route path="community/groups/new" element={<Fallback><CommunityCreateGroup /></Fallback>} />
          <Route path="community/groups/:groupId/settings" element={<Fallback><CommunityGroupSettings /></Fallback>} />
          <Route path="community/groups/:groupId" element={<Fallback><CommunityGroupDetails /></Fallback>} />
          <Route path="community/groups" element={<Fallback><CommunityGroups /></Fallback>} />
          <Route path="community/analysis/new" element={<Fallback><CommunityCreateAnalysis /></Fallback>} />
          <Route path="community/analysis/:documentId/versions" element={<Fallback><CommunityAnalysisVersions /></Fallback>} />
          <Route path="community/analysis/:documentId" element={<Fallback><CommunityAnalysisDetails /></Fallback>} />
          <Route path="community/analysis" element={<Fallback><CommunityAnalysis /></Fallback>} />
          <Route path="community/saved" element={<Fallback><CommunitySaved /></Fallback>} />
          <Route path="community/recommendations" element={<Fallback><CommunityRecommendations /></Fallback>} />
          <Route path="community/discussions" element={<Fallback><CommunityDiscussions /></Fallback>} />
          <Route path="community/messages/:conversationId" element={<Fallback><CommunityMessages /></Fallback>} />
          <Route path="community/messages" element={<Fallback><CommunityMessages /></Fallback>} />
          <Route path="community/moderation" element={<Fallback><CommunityModerationCenter /></Fallback>} />
          <Route path="community/*" element={<Fallback><CommunityFeed /></Fallback>} />
        </Route>
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
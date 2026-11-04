import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';

import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { consoleApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { getAdminCatalogPage } from '../../config/admin-navigation.js';
import { ConsoleAnalytics } from './ConsoleAnalytics.jsx';
import { ConsoleCreate } from './ConsoleCreate.jsx';
import { ConsoleDetail } from './ConsoleDetail.jsx';
import { ConsoleList } from './ConsoleList.jsx';
import { ConsoleOverview } from './ConsoleOverview.jsx';
import { ConsoleQuickActions } from './ConsoleQuickActions.jsx';
import { ConsoleSystem } from './ConsoleSystem.jsx';
import { humanize } from './console.utils.js';

export default function AdminCatalogRoute() {
  const { sectionId, pageId, recordId } = useParams();
  const navigation = getAdminCatalogPage(sectionId, pageId);
  const section = navigation?.section ?? { id: sectionId, label: humanize(sectionId) };

  const pageQuery = useQuery({
    queryKey: queryKeys.console.page(sectionId, pageId),
    queryFn: () => consoleApi.page(sectionId, pageId),
    retry: false,
  });

  if (pageQuery.isLoading) {
    return <LoadingState label="Loading admin page" />;
  }

  if (pageQuery.isError) {
    const message = getErrorMessage(pageQuery.error);
    const permissionError = /permission|forbidden|denied/i.test(message);
    return (
      <ErrorState
        title={permissionError ? 'You do not have access to this page' : 'Admin page unavailable'}
        description={message}
        onRetry={permissionError ? undefined : () => pageQuery.refetch()}
      />
    );
  }

  const page = pageQuery.data;
  if (!page) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admin page not registered"
        description="This route is not backed by an admin console page definition."
      />
    );
  }

  if (recordId) {
    return (
      <ConsoleDetail
        key={`${page.sectionId}:${page.pageId}:${recordId}`}
        page={page}
        section={section}
        recordId={recordId}
      />
    );
  }

  const key = `${page.sectionId}:${page.pageId}`;

  switch (page.display) {
    case 'overview':
      return <ConsoleOverview key={key} page={page} section={section} />;
    case 'analytics':
      return <ConsoleAnalytics key={key} page={page} section={section} />;
    case 'system':
      return <ConsoleSystem key={key} page={page} section={section} />;
    case 'actions':
      return <ConsoleQuickActions key={key} page={page} section={section} />;
    case 'create':
      return <ConsoleCreate key={key} page={page} section={section} />;
    case 'list':
    default:
      return <ConsoleList key={key} page={page} section={section} />;
  }
}

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, History } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { communityApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function AnalysisVersions() {
  const { documentId } = useParams();
  const dispatch = useDispatch();
  const versionsQuery = useQuery({
    queryKey: [...queryKeys.community.analysisDoc(documentId), 'versions'],
    queryFn: () => communityApi.listAnalysisVersions(documentId),
    enabled: Boolean(documentId),
  });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Analysis versions'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Community', path: ROUTES.app.community.overview },
      { label: 'Analysis', path: ROUTES.app.community.analysis },
      { label: 'Versions', path: ROUTES.app.community.analysisVersions(documentId) },
    ]));
  }, [dispatch, documentId]);

  if (versionsQuery.isLoading) return <LoadingState label="Loading versions" />;
  if (versionsQuery.isError) {
    return (
      <ErrorState
        title="Unable to load versions"
        description="You may not have access to this analysis document."
        onRetry={versionsQuery.refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link to={ROUTES.app.community.analysisDoc(documentId)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to analysis
        </Link>
      </Button>
      {(versionsQuery.data ?? []).map((version) => (
        <Card key={version.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Version {version.version}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {version.created_at ? formatDateTime(version.created_at) : ''}
            </p>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
              {version.content}
            </pre>
          </CardContent>
        </Card>
      ))}
      {(versionsQuery.data ?? []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No versions found.</CardContent></Card>
      ) : null}
    </div>
  );
}

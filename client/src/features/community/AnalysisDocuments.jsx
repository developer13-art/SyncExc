import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { useQuery } from '@tanstack/react-query';
import { communityApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatRelativeTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function AnalysisDocuments() {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Shared Analysis'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'Analysis', path: ROUTES.app.community.analysis },
      ]),
    );
  }, [dispatch]);

  const analysisQuery = useQuery({
    queryKey: queryKeys.community.analysis({ q: query || undefined }),
    queryFn: () => communityApi.listAnalysis({ q: query || undefined }),
  });

  const documents = analysisQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Shared Analysis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured research notes and collaborative analysis. Analysis is informational —
            it does not directly create trades.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.app.community.createAnalysis}>
            <Plus className="h-4 w-4" /> New analysis
          </Link>
        </Button>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search analysis…"
        className="w-full max-w-xs"
      />

      {analysisQuery.isLoading ? (
        <LoadingState label="Loading analysis" />
      ) : analysisQuery.isError ? (
        <ErrorState
          title="Unable to load analysis"
          description="We could not fetch analysis documents."
          onRetry={analysisQuery.refetch}
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={query ? 'No matching documents' : 'No analysis documents yet'}
          description={
            query
              ? 'Try a different search query.'
              : 'Create your first analysis document to organize your research.'
          }
          action={
            !query ? (
              <Button asChild>
                <Link to={ROUTES.app.community.createAnalysis}>Create analysis</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="overflow-hidden transition hover:border-primary/40">
              <Link to={ROUTES.app.community.analysisDoc(doc.id)} className="block p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {doc.title}
                  </p>
                  <Badge variant={doc.visibility === 'public' ? 'info' : 'muted'}>
                    {doc.visibility ?? 'private'}
                  </Badge>
                </div>
                {doc.summary ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {doc.summary}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(doc.tags ?? []).slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="muted" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-2xs text-muted-foreground">
                  Updated {doc.updatedAt ? formatRelativeTime(doc.updatedAt) : ''}
                </p>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
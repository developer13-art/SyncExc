import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { useQuery } from '@tanstack/react-query';
import { communityApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function AnalysisDetails() {
  const { documentId } = useParams();
  const dispatch = useDispatch();

  const docQuery = useQuery({
    queryKey: queryKeys.community.analysisDoc(documentId),
    queryFn: () => communityApi.getAnalysis(documentId),
    enabled: Boolean(documentId),
  });

  useEffect(() => {
    if (docQuery.data) {
      dispatch(uiActions.setPageTitle(docQuery.data.title));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Community', path: ROUTES.app.community.overview },
          { label: 'Analysis', path: ROUTES.app.community.analysis },
          {
            label: docQuery.data.title,
            path: ROUTES.app.community.analysisDoc(documentId),
          },
        ]),
      );
    }
  }, [docQuery.data, dispatch, documentId]);

  if (docQuery.isLoading) {
    return <LoadingState label="Loading document" />;
  }

  if (docQuery.error || !docQuery.data) {
    return (
      <ErrorState
        title="Unable to load document"
        description="This analysis document could not be retrieved."
        onRetry={docQuery.refetch}
      />
    );
  }

  const doc = docQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.community.analysis}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {doc.title}
            </h1>
            <Badge variant={doc.visibility === 'public' ? 'info' : 'muted'}>
              {doc.visibility ?? 'private'}
            </Badge>
            {doc.version ? (
              <Badge variant="muted">v{doc.version}</Badge>
            ) : null}
          </div>
          {doc.summary ? (
            <p className="mt-1 text-sm text-muted-foreground">{doc.summary}</p>
          ) : null}
          <p className="mt-1 text-2xs text-muted-foreground">
            {doc.author?.displayName ? `By ${doc.author.displayName} · ` : ''}
            Updated {doc.updatedAt ? formatDateTime(doc.updatedAt) : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.community.analysisVersions(documentId)}>
              View versions
            </Link>
          </Button>
        </div>
      </div>

      {doc.tags?.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {doc.tags.map((tag) => (
            <Badge key={tag} variant="muted">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-sm text-foreground">
            {doc.content}
          </div>
        </CardContent>
      </Card>

      {doc.sources?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {doc.sources.map((source, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
                >
                  <p className="text-foreground">{source.label}</p>
                  {source.provenance ? (
                    <Badge variant="muted" size="sm" className="mt-1">
                      {source.provenance}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-info/30 bg-info/5">
        <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
          Shared analysis is informational content. It does not directly create orders or
          positions. Any conversion into a signal or workflow requires explicit authorization,
          validation, and risk checks.
        </CardContent>
      </Card>
    </div>
  );
}
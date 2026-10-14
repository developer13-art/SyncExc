import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { adminUiActions } from '../../app/slices/adminUiSlice.js';
import { featureFlagsApi } from '../../api/index.js';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export default function FlagVersions() {
  const { flagId } = useParams();
  const dispatch = useDispatch();

  const versionsQuery = useQuery({
    queryKey: ['feature-flag', flagId, 'versions'],
    queryFn: () => featureFlagsApi.versions(flagId),
    enabled: Boolean(flagId),
  });

  useEffect(() => {
    dispatch(adminUiActions.setPageTitle('Flag Versions'));
    dispatch(
      adminUiActions.setBreadcrumbs([
        { label: 'Feature Flags', path: '/feature-flags' },
        { label: 'Flag', path: `/feature-flags/${flagId}` },
        { label: 'Versions', path: `/feature-flags/${flagId}/versions` },
      ]),
    );
  }, [dispatch, flagId]);

  if (versionsQuery.isLoading) {
    return <LoadingState label="Loading versions" />;
  }

  const versions = versionsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/feature-flags/${flagId}`}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Flag Version History
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable version history. Publishing creates a new version — historical evaluations
          remain traceable.
        </p>
      </div>

      {versions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No versions published yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {versions.map((version) => (
            <li key={version.id}>
              <Card>
                <CardContent className="p-5 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          Version {version.version}
                        </p>
                        {version.isCurrent ? (
                          <Badge variant="success" size="sm">
                            Current
                          </Badge>
                        ) : null}
                      </div>
                      {version.changeSummary ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {version.changeSummary}
                        </p>
                      ) : null}
                      <p className="mt-1 text-2xs text-muted-foreground">
                        {version.publishedAt ? formatDateTime(version.publishedAt) : ''}
                        {version.publishedBy ? ` · ${version.publishedBy}` : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
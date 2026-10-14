import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useRiskPolicy } from '../../hooks/useRisk.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function PolicyVersions() {
  const { policyId } = useParams();
  const { policy, versions, isLoading, error, refetch } = useRiskPolicy(policyId);

  if (isLoading) {
    return <LoadingState label="Loading versions" />;
  }

  if (error || !policy) {
    return (
      <ErrorState
        title="Unable to load versions"
        description="This policy's versions could not be retrieved."
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.risk.policy(policyId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Version history
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable versions of {policy.name}. Previous versions remain available for audit.
        </p>
      </div>

      {versions.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No version history available.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {versions.map((version) => (
            <li key={version.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm">
                        Version {version.version ?? '—'}
                      </CardTitle>
                      <p className="mt-1 text-2xs text-muted-foreground">
                        Created {version.createdAt ? formatDateTime(version.createdAt) : '—'}
                        {version.createdBy ? ` by ${version.createdBy}` : ''}
                      </p>
                    </div>
                    <Badge variant={version.status === 'active' ? 'success' : 'muted'}>
                      {version.status ?? 'draft'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {version.changeSummary ?? 'No change summary recorded.'}
                  </p>
                  {version.effectiveAt ? (
                    <p className="mt-2 text-2xs text-muted-foreground">
                      Effective {formatDateTime(version.effectiveAt)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
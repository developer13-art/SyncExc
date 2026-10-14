import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { useQuery } from '@tanstack/react-query';
import { sourcesApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { CheckCircle2, XCircle } from 'lucide-react';

export function SourceValidation({ sourceId }) {
  const validationsQuery = useQuery({
    queryKey: queryKeys.sources.validations(sourceId, {}),
    queryFn: () => sourcesApi.listValidations(sourceId),
    enabled: Boolean(sourceId),
  });

  const validations = validationsQuery.data?.items ?? [];

  if (validationsQuery.isLoading) {
    return <LoadingState label="Loading validation history" />;
  }

  if (validations.length === 0) {
    return (
      <EmptyState
        title="No validation runs yet"
        description="Trigger revalidation to test connectivity, access, and format compatibility."
        size="sm"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {validations.map((validation) => (
        <Card key={validation.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm">
                  {validation.result === 'passed'
                    ? 'Validation passed'
                    : validation.result === 'failed'
                      ? 'Validation failed'
                      : 'Validation in progress'}
                </CardTitle>
                <p className="mt-1 text-2xs text-muted-foreground">
                  {validation.startedAt ? formatDateTime(validation.startedAt) : '—'}
                  {validation.completedAt
                    ? ` · Completed ${formatDateTime(validation.completedAt)}`
                    : ''}
                </p>
              </div>
              <Badge
                variant={
                  validation.result === 'passed'
                    ? 'success'
                    : validation.result === 'failed'
                      ? 'destructive'
                      : 'warning'
                }
              >
                {validation.result ?? 'in progress'}
              </Badge>
            </div>
          </CardHeader>
          {validation.stages?.length > 0 ? (
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {validation.stages.map((stage) => (
                  <li
                    key={stage.name}
                    className="flex items-start justify-between gap-3 py-2"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      {stage.result === 'passed' ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      ) : stage.result === 'failed' ? (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{stage.label ?? stage.name}</p>
                        {stage.detail ? (
                          <p className="mt-0.5 text-2xs text-muted-foreground">
                            {stage.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Badge
                      variant={
                        stage.result === 'passed'
                          ? 'success'
                          : stage.result === 'failed'
                            ? 'destructive'
                            : 'muted'
                      }
                    >
                      {stage.result ?? 'pending'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
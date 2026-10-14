import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';

export function ComparisonView({ comparison }) {
  if (!comparison) {
    return null;
  }

  const runs = comparison.runs ?? [];
  const metricKeys = comparison.metricKeys ?? [];

  return (
    <div className="flex flex-col gap-4">
      {comparison.incompatibilityWarning ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          {comparison.incompatibilityWarning}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Run comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto scrollbar-thin p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="border-b border-border px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Metric
                </th>
                {runs.map((run) => (
                  <th
                    key={run.id}
                    className="border-b border-border px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{run.name}</p>
                      {run.datasetName ? (
                        <p className="mt-0.5 text-2xs font-normal text-muted-foreground">
                          {run.datasetName}
                        </p>
                      ) : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricKeys.map((metric) => (
                <tr key={metric.key} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-xs text-foreground">{metric.label}</td>
                  {runs.map((run) => (
                    <td key={run.id} className="px-4 py-2 text-xs">
                      {run.metrics?.[metric.key]?.display ?? run.metrics?.[metric.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {comparison.differences?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration differences</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {comparison.differences.map((diff, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                  <span className="text-sm text-foreground">{diff.label}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="muted">{diff.from}</Badge>
                    →
                    <Badge variant="info">{diff.to}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { QualityMetrics } from './components/QualityMetrics.jsx';
import { useSource } from '../../hooks/useSources.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';

export function SourceQuality({ sourceId }) {
  const { quality, isLoading } = useSource(sourceId);

  if (isLoading) {
    return <LoadingState label="Loading quality" />;
  }

  if (!quality) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No quality data available. Collect events for a longer period to build a
          representative sample.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Observation window</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field
            label="Window start"
            value={quality.windowStart ? formatDateTime(quality.windowStart) : '—'}
          />
          <Field
            label="Window end"
            value={quality.windowEnd ? formatDateTime(quality.windowEnd) : '—'}
          />
          <Field label="Sample size" value={quality.sampleSize?.toLocaleString() ?? '—'} />
          <Field label="Score version" value={quality.scoreVersion ?? 'v1'} />
        </CardContent>
      </Card>

      <QualityMetrics metrics={quality.metrics ?? quality} />

      {quality.notes ? (
        <Card>
          <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
            {quality.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function MetricsTable({ metrics = {}, className }) {
  const entries = Object.entries(metrics);
  if (entries.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Run metrics</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
        {entries.map(([key, rawValue]) => {
          const value =
            typeof rawValue === 'object' && rawValue !== null
              ? rawValue.display ?? rawValue.value
              : rawValue;
          const tone = typeof rawValue === 'object' ? rawValue.tone : undefined;
          return (
            <div key={key}>
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                {humanize(key)}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-semibold',
                  tone === 'success' && 'text-success',
                  tone === 'destructive' && 'text-destructive',
                  tone === 'warning' && 'text-warning',
                  !tone && 'text-foreground',
                )}
              >
                {value ?? '—'}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function humanize(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
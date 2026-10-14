import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { ProgressBar } from '../../../components/ui/ProgressBar.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function QualityMetrics({ metrics = {}, className }) {
  const items = [
    {
      key: 'completeness',
      label: 'Message completeness',
      value: metrics.completeness,
      hint: 'Fields present vs. expected',
    },
    {
      key: 'parsing',
      label: 'Parsing quality',
      value: metrics.parsingSuccess,
      hint: 'Messages parsed without assumptions',
    },
    {
      key: 'freshness',
      label: 'Freshness',
      value: metrics.freshness,
      hint: 'Delay between event and receipt',
    },
    {
      key: 'duplicateControl',
      label: 'Duplicate control',
      value: metrics.duplicateControl,
      hint: 'Higher is better',
    },
  ];

  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      {items.map((item) => {
        const percent =
          typeof item.value === 'number' ? Math.max(0, Math.min(100, item.value)) : null;

        return (
          <Card key={item.key}>
            <CardContent className="p-4 pt-4">
              <p className="text-xs font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-2xs text-muted-foreground">{item.hint}</p>
              {percent !== null ? (
                <div className="mt-3">
                  <div className="mb-1.5 flex justify-between text-2xs text-muted-foreground">
                    <span>{percent.toFixed(0)}%</span>
                  </div>
                  <ProgressBar
                    value={percent}
                    indicatorClassName={
                      percent >= 80
                        ? undefined
                        : percent >= 60
                          ? 'bg-warning'
                          : 'bg-destructive'
                    }
                  />
                </div>
              ) : (
                <p className="mt-3 text-2xs text-muted-foreground">
                  Insufficient data
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
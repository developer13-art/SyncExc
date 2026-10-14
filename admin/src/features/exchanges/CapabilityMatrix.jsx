import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';

const SUPPORT_VARIANTS = {
  supported: 'success',
  unsupported: 'muted',
  unknown: 'warning',
  testing: 'info',
  degraded: 'warning',
};

export function CapabilityMatrix({ capabilities = [] }) {
  if (capabilities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No capability data available.
        </CardContent>
      </Card>
    );
  }

  const grouped = capabilities.reduce((acc, capability) => {
    const group = capability.category ?? 'Other';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(capability);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capability matrix</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </p>
            <ul className="flex flex-col divide-y divide-border">
              {items.map((capability) => (
                <li
                  key={capability.key}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      {capability.label ?? capability.key}
                    </p>
                    {capability.limitation ? (
                      <p className="mt-0.5 text-2xs text-muted-foreground">
                        {capability.limitation}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={SUPPORT_VARIANTS[capability.status] ?? 'muted'}>
                    {capability.status?.replace(/_/g, ' ') ?? 'unknown'}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
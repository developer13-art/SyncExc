import { useMemo } from 'react';
import { Check } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Checkbox } from '../../components/ui/Checkbox.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function PermissionMatrix({ permissions = [], selected = [], onToggle }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const permission of permissions) {
      const group = permission.group ?? permission.category ?? 'General';
      if (!map.has(group)) {
        map.set(group, []);
      }
      map.get(group).push(permission);
    }
    return Array.from(map.entries());
  }, [permissions]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Permissions</CardTitle>
          <span className="text-xs text-muted-foreground">
            {selected.length} of {permissions.length} selected
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {grouped.map(([group, items]) => (
          <div key={group}>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
            <ul className="flex flex-col gap-1.5">
              {items.map((permission) => {
                const isSelected = selected.includes(permission.key);
                return (
                  <li key={permission.key}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition',
                        isSelected
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border hover:bg-muted/40',
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggle?.(permission.key)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <code className="text-xs font-medium text-foreground">
                            {permission.key}
                          </code>
                          {permission.sensitive ? (
                            <Badge variant="warning" size="sm">
                              Sensitive
                            </Badge>
                          ) : null}
                          {permission.requiresApproval ? (
                            <Badge variant="info" size="sm">
                              Approval required
                            </Badge>
                          ) : null}
                        </span>
                        {permission.description ? (
                          <span className="mt-1 block text-2xs text-muted-foreground">
                            {permission.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
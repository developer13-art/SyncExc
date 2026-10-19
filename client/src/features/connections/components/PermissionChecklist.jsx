import { AlertTriangle, Check, HelpCircle, X } from 'lucide-react';

import { cn } from '../../../lib/utils/cn.util.js';

const STATE_CONFIG = {
  verified: { icon: Check, className: 'text-success', label: 'Verified' },
  missing_permission: {
    icon: X,
    className: 'text-destructive',
    label: 'Missing permission',
  },
  unsupported: { icon: X, className: 'text-muted-foreground', label: 'Unsupported' },
  not_permitted: {
    icon: AlertTriangle,
    className: 'text-destructive',
    label: 'Not permitted by SyncExc',
  },
  unknown: { icon: HelpCircle, className: 'text-warning', label: 'Unable to verify' },
  temporarily_unavailable: {
    icon: HelpCircle,
    className: 'text-warning',
    label: 'Temporarily unavailable',
  },
};

export function PermissionChecklist({ permissions = {}, className }) {
  const entries = Array.isArray(permissions)
    ? permissions.map((permission, index) => [
        permission.key ?? permission.permissionKey ?? String(index),
        permission.verification ?? permission.status ?? 'unknown',
      ])
    : Object.entries(permissions);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No permissions to display.</p>
    );
  }

  return (
    <ul className={cn('flex flex-col divide-y divide-border', className)}>
      {entries.map(([key, rawValue]) => {
        const state = typeof rawValue === 'string' ? rawValue : rawValue?.status ?? 'unknown';
        const config = STATE_CONFIG[state] ?? STATE_CONFIG.unknown;
        const Icon = config.icon;

        return (
          <li key={key} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {rawValue?.label ?? humanizePermission(key)}
              </p>
              {rawValue?.description ? (
                <p className="text-2xs text-muted-foreground">{rawValue.description}</p>
              ) : null}
            </div>
            <span className={cn('flex items-center gap-1.5 text-xs font-medium', config.className)}>
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function humanizePermission(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
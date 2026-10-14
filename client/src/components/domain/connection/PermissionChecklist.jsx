import { Check, X, HelpCircle } from 'lucide-react';

import { cn } from '../../../lib/utils/cn.util.js';

const PERMISSION_LABELS = {
  accountRead: 'Account Information',
  spotTrading: 'Spot Trading',
  derivativesTrading: 'Derivatives Trading',
  withdrawals: 'Withdrawals',
};

const STATE_CONFIG = {
  verified: { icon: Check, className: 'text-success' },
  missing_permission: { icon: X, className: 'text-destructive' },
  unsupported: { icon: X, className: 'text-muted-foreground' },
  unknown: { icon: HelpCircle, className: 'text-warning' },
  not_permitted: { icon: X, className: 'text-muted-foreground' },
};

export function PermissionChecklist({ permissions = {}, className }) {
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {Object.entries(permissions).map(([key, value]) => {
        const state = typeof value === 'string' ? value : value?.status ?? 'unknown';
        const config = STATE_CONFIG[state] ?? STATE_CONFIG.unknown;
        const Icon = config.icon;
        return (
          <li key={key} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{PERMISSION_LABELS[key] ?? key}</span>
            <span className={cn('flex items-center gap-1 text-xs font-medium', config.className)}>
              <Icon className="h-3.5 w-3.5" />
              {state.replace(/_/g, ' ')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
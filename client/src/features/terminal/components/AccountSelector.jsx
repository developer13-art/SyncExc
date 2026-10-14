import { useMemo } from 'react';
import { Building2 } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select.jsx';
import { ConnectionHealthBadge } from '../../../components/domain/connection/ConnectionHealthBadge.jsx';

export function AccountSelector({ accounts = [], value, onChange, className }) {
  const grouped = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      const key = account.connectionId ?? account.exchangeName ?? 'other';
      if (!map.has(key)) {
        map.set(key, {
          connectionId: key,
          exchangeName: account.exchangeName ?? 'Unknown',
          accounts: [],
        });
      }
      map.get(key).accounts.push(account);
    }
    return Array.from(map.values());
  }, [accounts]);

  if (accounts.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="No accounts available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select account" />
      </SelectTrigger>
      <SelectContent>
        {grouped.map((group) => (
          <div key={group.connectionId}>
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {group.exchangeName}
            </div>
            {group.accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <span className="flex items-center gap-2">
                  <span className="truncate">{account.label ?? account.type ?? account.id}</span>
                  {account.healthStatus ? (
                    <ConnectionHealthBadge status={account.healthStatus} />
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
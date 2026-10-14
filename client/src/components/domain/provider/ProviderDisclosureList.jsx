import { FileText } from 'lucide-react';

import { cn } from '../../../lib/utils/cn.util.js';
import { formatDateTime } from '../../../lib/formatters/date.formatter.js';

export function ProviderDisclosureList({ disclosures = [], className }) {
  if (disclosures.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {disclosures.map((disclosure, i) => (
        <div key={i} className="rounded-md border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{disclosure.title}</p>
          </div>
          {disclosure.body ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{disclosure.body}</p>
          ) : null}
          {disclosure.effectiveAt ? (
            <p className="mt-2 text-2xs text-muted-foreground">
              Effective {formatDateTime(disclosure.effectiveAt)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
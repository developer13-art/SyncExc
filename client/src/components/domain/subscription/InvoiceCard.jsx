import { Download, FileText } from 'lucide-react';

import { Card } from '../../ui/Card.jsx';
import { Button } from '../../ui/Button.jsx';
import { PaymentStatusBadge } from './PaymentStatusBadge.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../../lib/formatters/date.formatter.js';

export function InvoiceCard({ invoice, onDownload, className }) {
  if (!invoice) {
    return null;
  }

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Invoice {invoice.number ?? invoice.id}
            </p>
            <p className="text-xs text-muted-foreground">
              Issued {invoice.issuedAt ? formatDate(invoice.issuedAt) : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PaymentStatusBadge status={invoice.status} />
          <span className="text-sm font-semibold text-foreground">
            {formatCurrency(invoice.total, invoice.currency)}
          </span>
          {onDownload ? (
            <Button variant="ghost" size="sm" onClick={() => onDownload(invoice)}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
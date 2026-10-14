import { Link } from 'react-router-dom';

import { DataTable } from '../../../components/ui/DataTable.jsx';
import { PaymentStatusBadge } from '../../../components/domain/payment/PaymentStatusBadge.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../../config/routes.config.js';

export function InvoiceTable({ invoices = [], isLoading, className }) {
  const columns = [
    {
      key: 'number',
      label: 'Invoice',
      render: (row) => (
        <Link
          to={ROUTES.app.billing.invoice(row.id)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.number ?? row.id?.slice(0, 12)}
        </Link>
      ),
    },
    {
      key: 'issuedAt',
      label: 'Issued',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.issuedAt ? formatDate(row.issuedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'period',
      label: 'Period',
      render: (row) =>
        row.periodStart && row.periodEnd ? (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.periodStart)} – {formatDate(row.periodEnd)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.total, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <PaymentStatusBadge status={row.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={invoices}
      isLoading={isLoading}
      emptyTitle="No invoices yet"
      emptyDescription="Invoices will appear here after your first billing period."
      className={className}
    />
  );
}
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../../lib/formatters/date.formatter.js';

const STATUS_VARIANT = {
  accumulated: 'info',
  approved: 'info',
  held: 'warning',
  released: 'success',
  adjusted: 'warning',
  reversed: 'destructive',
  payable: 'success',
  paid: 'success',
};

export function CommissionTable({ commissions = [], isLoading, className }) {
  const columns = [
    {
      key: 'createdAt',
      label: 'Date',
      render: (row) => (row.createdAt ? formatDate(row.createdAt) : '—'),
    },
    {
      key: 'referralCode',
      label: 'Referral',
      render: (row) => (
        <span className="font-mono text-xs text-foreground">
          {row.referralCode ?? row.referralId ?? '—'}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.sourceType === 'first_payment'
            ? 'First payment'
            : row.sourceType === 'recurring'
              ? 'Recurring'
              : (row.sourceType?.replace(/_/g, ' ') ?? '—')}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.amount, row.currency ?? 'USD')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? 'muted'}>
          {row.status?.replace(/_/g, ' ') ?? 'unknown'}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={commissions}
      isLoading={isLoading}
      emptyTitle="No commissions yet"
      emptyDescription="Commissions appear here once a qualifying subscription payment is attributed."
      className={className}
    />
  );
}
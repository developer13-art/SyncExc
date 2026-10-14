import { DataTable } from '../../ui/DataTable.jsx';
import { Badge } from '../../ui/Badge.jsx';
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
    { key: 'referralCode', label: 'Referral' },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (row) => formatCurrency(row.amount, row.currency ?? 'USD'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? 'muted'}>
          {row.status ?? 'unknown'}
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
      emptyDescription="Commissions will appear here once a qualifying subscription payment is attributed."
      className={className}
    />
  );
}
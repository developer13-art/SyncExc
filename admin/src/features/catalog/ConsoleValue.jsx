import { Badge } from '../../components/ui/Badge.jsx';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatNumber } from '../../lib/formatters/number.formatter.js';
import { formatDate, formatDateTime } from '../../lib/formatters/date.formatter.js';
import { humanize, statusVariant } from './console.utils.js';

function textOf(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function ConsoleValue({ column, row, detailed = false }) {
  const value = row?.[column.key];

  if (value === null || value === undefined || value === '') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  switch (column.kind) {
    case 'status':
      return (
        <Badge variant={statusVariant(value)} className="capitalize">
          {humanize(value)}
        </Badge>
      );
    case 'boolean':
      return (
        <Badge variant={value ? 'success' : 'muted'}>
          {value ? 'Yes' : 'No'}
        </Badge>
      );
    case 'currency': {
      const currency = row?.[column.currencyKey] || 'USD';
      const numeric = Number(value);
      return (
        <span className="tabular-nums text-foreground">
          {formatCurrency(Number.isFinite(numeric) ? numeric / 100 : value, currency)}
        </span>
      );
    }
    case 'number':
      return <span className="tabular-nums text-foreground">{formatNumber(value)}</span>;
    case 'date':
      return (
        <span className="text-xs text-muted-foreground">
          {detailed ? formatDateTime(value) : formatDate(value)}
        </span>
      );
    case 'json': {
      const isMasked = value && typeof value === 'object' && value.masked;
      if (isMasked) {
        return <Badge variant="warning">Sensitive value</Badge>;
      }
      const serialized = textOf(value);
      if (detailed) {
        return (
          <pre className="max-h-96 overflow-auto rounded-md bg-muted/40 p-3 text-2xs text-foreground">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      }
      return (
        <span className="block max-w-[22rem] truncate font-mono text-2xs text-muted-foreground" title={serialized}>
          {serialized}
        </span>
      );
    }
    case 'truncated': {
      const serialized = textOf(value);
      return (
        <span className="block max-w-[24rem] truncate text-xs text-foreground" title={serialized}>
          {serialized}
        </span>
      );
    }
    default: {
      const serialized = textOf(value);
      return (
        <span
          className={detailed ? 'break-words text-sm text-foreground' : 'block max-w-[20rem] truncate text-xs text-foreground'}
          title={typeof value === 'object' ? serialized : undefined}
        >
          {serialized}
        </span>
      );
    }
  }
}

export default ConsoleValue;

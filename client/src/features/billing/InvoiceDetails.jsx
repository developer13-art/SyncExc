import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { PaymentStatusBadge } from '../../components/domain/payment/PaymentStatusBadge.jsx';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { formatCurrency } from '../../lib/formatters/currency.formatter.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';
import { downloadBlob } from '../../lib/utils/download.util.js';
import { ROUTES } from '../../config/routes.config.js';

export default function InvoiceDetails() {
  const { invoiceId } = useParams();
  const toast = useToast();

  const invoiceQuery = useQuery({
    queryKey: queryKeys.billing.invoice(invoiceId),
    queryFn: () => billingApi.getInvoice(invoiceId),
    enabled: Boolean(invoiceId),
  });

  if (invoiceQuery.isLoading) {
    return <LoadingState label="Loading invoice" />;
  }

  if (invoiceQuery.error || !invoiceQuery.data) {
    return (
      <ErrorState
        title="Unable to load invoice"
        description="This invoice could not be retrieved."
        onRetry={invoiceQuery.refetch}
      />
    );
  }

  const invoice = invoiceQuery.data;

  const handleDownload = async () => {
    try {
      const response = await billingApi.downloadInvoice(invoiceId);
      if (response?.data) {
        downloadBlob(response.data, `${invoice.number ?? 'invoice'}.pdf`);
      }
    } catch (err) {
      toast.error('Download failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.billing.invoices}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Invoice {invoice.number ?? invoice.id?.slice(0, 12)}
            </h1>
            <PaymentStatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued {invoice.issuedAt ? formatDate(invoice.issuedAt) : '—'}
          </p>
        </div>
        <Button variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field
            label="Billing period"
            value={
              invoice.periodStart && invoice.periodEnd
                ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                : '—'
            }
          />
          <Field label="Plan" value={invoice.planName ?? '—'} />
          <Field label="Currency" value={invoice.currency ?? '—'} />
          <Field
            label="Payment status"
            value={<PaymentStatusBadge status={invoice.status} />}
          />
        </CardContent>
      </Card>

      {invoice.lineItems?.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {invoice.lineItems.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.description}</p>
                    {item.period ? (
                      <p className="mt-0.5 text-2xs text-muted-foreground">
                        {item.period}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    {formatCurrency(item.amount, invoice.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-2 p-5 pt-5 text-sm">
          <SummaryRow
            label="Subtotal"
            value={formatCurrency(invoice.subtotal, invoice.currency)}
          />
          {invoice.tax !== undefined ? (
            <SummaryRow
              label="Tax"
              value={formatCurrency(invoice.tax, invoice.currency)}
            />
          ) : null}
          {invoice.discount !== undefined && Number(invoice.discount) !== 0 ? (
            <SummaryRow
              label="Discount"
              value={`-${formatCurrency(invoice.discount, invoice.currency)}`}
              tone="success"
            />
          ) : null}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-base font-semibold text-foreground">
              {formatCurrency(invoice.total, invoice.currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      {invoice.providerReference ? (
        <p className="text-2xs text-muted-foreground">
          Provider reference: <span className="font-mono">{invoice.providerReference}</span>
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          tone === 'success' ? 'font-medium text-success' : 'font-medium text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}
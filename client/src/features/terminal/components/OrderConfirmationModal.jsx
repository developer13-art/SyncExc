import { AlertTriangle } from 'lucide-react';

import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function OrderConfirmationModal({
  open,
  onOpenChange,
  order,
  instrument,
  account,
  onConfirm,
  isSubmitting,
  approvalRequired = false,
  approvalMessage = '',
}) {
  if (!order) {
    return null;
  }

  const isBuy = order.side === 'buy';
  const notional =
    order.quantity && (order.price || instrument?.markPrice || instrument?.lastPrice)
      ? Number(order.quantity) * Number(order.price ?? instrument.markPrice ?? instrument.lastPrice)
      : 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={approvalRequired ? 'Approve order after risk review' : 'Confirm order'}
      description={
        approvalRequired
          ? 'The initial risk check requires a separate workspace approval before dispatch.'
          : 'Review the details below before submitting.'
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isBuy ? 'success' : 'destructive'}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? approvalRequired
                ? 'Approving…'
                : 'Submitting…'
              : approvalRequired
                ? 'Approve and submit'
                : 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <Row label="Account" value={account?.label ?? account?.id ?? '—'} />
        <Row label="Instrument" value={instrument?.symbol ?? '—'} />
        <Row
          label="Side"
          value={
            <span
              className={cn(
                'font-semibold uppercase',
                isBuy ? 'text-success' : 'text-destructive',
              )}
            >
              {order.side}
            </span>
          }
        />
        <Row label="Type" value={order.type} />
        {order.price ? (
          <Row label="Price" value={formatQuantity(order.price, 8)} />
        ) : null}
        {order.stopPrice ? (
          <Row label="Stop price" value={formatQuantity(order.stopPrice, 8)} />
        ) : null}
        <Row label="Quantity" value={formatQuantity(order.quantity, 8)} />
        {order.timeInForce ? <Row label="TIF" value={order.timeInForce} /> : null}
        {order.leverage ? <Row label="Leverage" value={`${order.leverage}x`} /> : null}
        {order.reduceOnly ? <Row label="Reduce only" value="Yes" /> : null}
        {notional > 0 ? (
          <Row
            label="Estimated notional"
            value={formatCurrency(notional, instrument?.quoteAsset ?? 'USD')}
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <p>
          {approvalRequired && approvalMessage
            ? `${approvalMessage} The exchange may still reject or partially fill the order.`
            : 'Pre-trade risk checks run before dispatch. The exchange may still reject the order or partially fill it. Refer to the execution status after submission.'}
        </p>
      </div>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
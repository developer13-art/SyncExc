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
  orderPreview,
  usdConversionRate,
  usdConversionApproximate = false,
  balanceFreshness = 'unknown',
  destinationPreviews = [],
  onConfirm,
  isSubmitting,
  approvalRequired = false,
  approvalMessage = '',
}) {
  if (!order) {
    return null;
  }

  const isBuy = order.side === 'buy';
  const notional = orderPreview?.notional ?? 0;
  const hasFreshInsufficientDestination = destinationPreviews.some(
    ({ preview, freshness }) => preview?.sufficient === false && freshness === 'current',
  );

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
            disabled={isSubmitting || hasFreshInsufficientDestination}
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
        {notional > 0 ? (
          <Row
            label="Estimated USD total"
            value={
              usdConversionRate
                ? `${usdConversionApproximate ? '≈ ' : ''}${formatCurrency(
                    notional * usdConversionRate,
                    'USD',
                  )}`
                : 'Unavailable for this quote asset'
            }
          />
        ) : null}
        {orderPreview?.requiredBalance != null ? (
          <Row
            label={`Balance check · ${orderPreview.requiredAsset}`}
            value={
              orderPreview.sufficient === true
                ? `${formatQuantity(orderPreview.availableBalance, 6)} available · sufficient (${balanceFreshness} snapshot)`
                : orderPreview.sufficient === false
                  ? `${formatQuantity(orderPreview.availableBalance, 6)} available · insufficient (${balanceFreshness} snapshot)`
                  : 'Unable to estimate from latest balance snapshot'
            }
          />
        ) : null}
        {destinationPreviews.length > 0 ? (
          <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
            <p className="font-semibold text-foreground">Synchronization destinations</p>
            {destinationPreviews.map(({ account, preview, freshness, isLoading, error }) => {
              const usdTotal = preview?.notional && usdConversionRate
                ? formatCurrency(preview.notional * usdConversionRate, 'USD')
                : 'USD estimate unavailable';
              const balanceText = isLoading
                ? 'Refreshing balance…'
                : error
                  ? 'Balance unavailable; the server will validate before submission'
                  : preview?.sufficient === true
                    ? `Sufficient ${preview.requiredAsset} balance (${freshness} snapshot)`
                    : preview?.sufficient === false
                      ? `Insufficient ${preview.requiredAsset} balance (${freshness} snapshot)`
                      : 'Unable to estimate; the server will validate before submission';
              return (
                <div key={account.id} className="rounded-md border border-border p-2">
                  <p className="font-medium text-foreground">{account.label ?? account.id}</p>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    Approx. {usdTotal} · {balanceText}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <p>
          {approvalRequired && approvalMessage
            ? `${approvalMessage} The exchange may still reject or partially fill the order.`
            : destinationPreviews.length > 0
              ? 'The source exchange can still reject or partially fill the order. Destination orders are sent only after a confirmed full fill, and destination checks run again before each submission.'
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
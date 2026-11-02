import { AlertTriangle } from 'lucide-react';

import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { AccountSelector } from './AccountSelector.jsx';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function OrderConfirmationModal({
  open,
  onOpenChange,
  order,
  instrument,
  destinationAccounts = [],
  account,
  destinationAccountId,
  onDestinationAccountChange,
  destinationInstrument,
  destinationMarketsLoading = false,
  destinationMarketsError = false,
  onRetryDestinationMarkets,
  destinationMarketDataLoading = false,
  destinationMarketDataError = false,
  destinationBalanceLoading = false,
  destinationBalanceError = false,
  marketDataVenue,
  universalMode = false,
  orderPreview,
  usdConversionRate,
  usdConversionApproximate = false,
  balanceFreshness = 'unknown',
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
  const hasFreshInsufficientBalance =
    orderPreview?.sufficient === false && balanceFreshness === 'current';
  const destinationReady =
    !universalMode ||
    (Boolean(account && destinationInstrument) &&
      !destinationMarketsLoading &&
      !destinationMarketsError);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={approvalRequired ? 'Approve order after risk review' : 'Confirm order'}
      description={
        approvalRequired
          ? 'The initial risk check requires a separate workspace approval before dispatch.'
          : 'Your order details are valid. Select an execution destination, then review the final checks.'
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isBuy ? 'success' : 'destructive'}
            onClick={onConfirm}
            disabled={
              isSubmitting ||
              !destinationReady ||
              (!universalMode && hasFreshInsufficientBalance)
            }
          >
            {isSubmitting
              ? approvalRequired
                ? 'Approving…'
                : 'Submitting…'
              : approvalRequired
                ? 'Approve and submit'
                  : 'Submit order'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {universalMode ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground">Execution destination</span>
            <AccountSelector
              accounts={destinationAccounts}
              value={destinationAccountId}
              onChange={onDestinationAccountChange}
              disabled={approvalRequired || isSubmitting}
            />
            {account ? (
              <span className="text-2xs text-muted-foreground">
                {account.exchangeName} · {account.environment} · {account.type}
              </span>
            ) : null}
            {!destinationAccounts.length ? (
              <span className="text-2xs text-destructive">
                No active destination accounts are available in this workspace.
              </span>
            ) : null}
            {destinationMarketsLoading ? (
              <span className="text-2xs text-muted-foreground">
                Checking this instrument on the selected exchange…
              </span>
            ) : null}
            {destinationMarketsError ? (
              <div className="flex items-center justify-between gap-2 text-2xs text-destructive">
                <span>Could not verify the instrument on this destination.</span>
                <Button type="button" size="sm" variant="outline" onClick={onRetryDestinationMarkets}>
                  Retry
                </Button>
              </div>
            ) : null}
            {destinationAccountId &&
            !destinationMarketsLoading &&
            !destinationMarketsError &&
            !destinationInstrument ? (
              <span className="text-2xs text-destructive">
                This instrument and market type are not available on the selected exchange.
              </span>
            ) : null}
            {destinationMarketDataLoading ? (
              <span className="text-2xs text-muted-foreground">
                Refreshing the destination market quote…
              </span>
            ) : null}
            {destinationMarketDataError ? (
              <span className="text-2xs text-warning">
                Destination quote is unavailable; the exchange will validate current market conditions.
              </span>
            ) : null}
            {destinationBalanceLoading ? (
              <span className="text-2xs text-muted-foreground">
                Refreshing the destination balance estimate…
              </span>
            ) : null}
            {destinationBalanceError ? (
              <span className="text-2xs text-warning">
                Balance estimate unavailable; the server will validate available funds.
              </span>
            ) : null}
          </div>
        ) : (
          <Row label="Account" value={account?.label ?? account?.id ?? '—'} />
        )}
        {universalMode && marketDataVenue ? (
          <Row label="Market data venue" value={marketDataVenue} />
        ) : null}
        <Row
          label="Instrument"
          value={destinationInstrument?.symbol ?? instrument?.symbol ?? '—'}
        />
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
            label={`Estimated ${orderPreview.requiredAsset} balance`}
            value={
              orderPreview.sufficient === true
                ? `${formatQuantity(orderPreview.availableBalance, 6)} available (${balanceFreshness} snapshot)`
                : orderPreview.sufficient === false
                  ? `${formatQuantity(orderPreview.availableBalance, 6)} available (${balanceFreshness} snapshot)`
                  : 'Unable to estimate from latest balance snapshot'
            }
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <p>
          {approvalRequired && approvalMessage
            ? `${approvalMessage} The exchange may still reject or partially fill the order.`
            : universalMode
              ? 'The server rechecks destination access, exchange permissions, instrument rules, available funds, and risk policies before dispatch. The exchange may still reject or partially fill the order.'
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
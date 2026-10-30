import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Info } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Label } from '../../../components/ui/Label.jsx';
import { Switch } from '../../../components/ui/Switch.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select.jsx';
import { SegmentedControl } from '../../../components/navigation/SegmentedControl.jsx';
import { Slider } from '../../../components/ui/Slider.jsx';
import { formatQuantity } from '../../../lib/formatters/number.formatter.js';
import { formatCurrency } from '../../../lib/formatters/currency.formatter.js';
import {
  calculateOrderPreview,
  getUsdConversionRate,
} from '../../../lib/trading/order-preview.js';
import { cn } from '../../../lib/utils/cn.util.js';

const SPOT_ORDER_TYPES = [
  { value: 'limit', label: 'Limit' },
  { value: 'market', label: 'Market' },
];

const FUTURES_ORDER_TYPES = [
  { value: 'limit', label: 'Limit' },
  { value: 'market', label: 'Market' },
  { value: 'stop_market', label: 'Stop Market' },
  { value: 'stop_limit', label: 'Stop Limit' },
];

const TIME_IN_FORCE = [
  { value: 'GTC', label: 'GTC' },
  { value: 'IOC', label: 'IOC' },
  { value: 'FOK', label: 'FOK' },
];

export function OrderForm({
  instrument,
  account,
  marketType = 'spot',
  onSubmit,
  isSubmitting = false,
  availableBalance,
  availableMargin,
  availableBalances,
  balanceFreshness,
  isBalancesLoading = false,
  referencePrice,
  usdConversionRate,
  usdConversionApproximate = false,
  maxLeverage,
  defaultOrderType = 'limit',
  className,
}) {
  const isFutures = marketType === 'futures' || marketType === 'perpetual';

  const [side, setSide] = useState('buy');
  const [percent, setPercent] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      type: defaultOrderType,
      timeInForce: 'GTC',
      price: '',
      quantity: '',
      stopPrice: '',
      reduceOnly: false,
      leverage: 1,
    },
  });

  useEffect(() => {
    const supportedTypes = isFutures
      ? FUTURES_ORDER_TYPES.map((option) => option.value)
      : SPOT_ORDER_TYPES.map((option) => option.value);
    setValue('type', supportedTypes.includes(defaultOrderType) ? defaultOrderType : 'limit');
  }, [defaultOrderType, isFutures, setValue]);

  const type = watch('type');
  const price = watch('price');
  const quantity = watch('quantity');
  const leverage = watch('leverage');

  const isMarketOrder = type === 'market' || type === 'stop_market';
  const needsStopPrice = type === 'stop_market' || type === 'stop_limit';
  const hasSideBalance = availableBalances &&
    Object.prototype.hasOwnProperty.call(availableBalances, side);
  const currentAvailableBalance = hasSideBalance
    ? availableBalances[side]
    : isFutures
      ? availableMargin
      : side === 'buy'
        ? availableMargin
        : availableBalance;

  const orderPreview = useMemo(
    () =>
      calculateOrderPreview({
        side,
        marketType,
        orderType: type,
        quantity,
        price,
        referencePrice: referencePrice ?? instrument?.markPrice ?? instrument?.lastPrice,
        baseAsset: instrument?.baseAsset,
        quoteAsset: instrument?.quoteAsset,
        baseBalance: availableBalance,
        quoteBalance: availableMargin,
        leverage,
      }),
    [
      side,
      marketType,
      type,
      quantity,
      price,
      referencePrice,
      instrument,
      availableBalance,
      availableMargin,
      leverage,
    ],
  );
  const notional = orderPreview.notional ?? 0;
  const resolvedUsdConversionRate =
    usdConversionRate ?? getUsdConversionRate(instrument?.quoteAsset, null, null);
  const approximateUsdConversion =
    usdConversionApproximate ||
    ['USDT', 'USDC'].includes(String(instrument?.quoteAsset || '').toUpperCase());
  const balanceKnownInsufficient =
    balanceFreshness === 'current' && orderPreview.sufficient === false;

  const applyPercent = (nextPercent) => {
    setPercent(nextPercent);
    const base = currentAvailableBalance;
    if (!base || !instrument) {
      return;
    }
    const refPrice = isMarketOrder
      ? Number(referencePrice ?? instrument.markPrice ?? instrument.lastPrice ?? 0)
      : Number(price);
    if (!Number.isFinite(refPrice) || refPrice <= 0) {
      return;
    }
    const usable = Number(base) * (nextPercent / 100);
    const size = isFutures
      ? (usable * Number(leverage)) / refPrice
      : side === 'buy'
        ? usable / refPrice
        : usable;
    setValue('quantity', formatQuantity(size, instrument.quantityPrecision ?? 6), {
      shouldValidate: true,
    });
  };

  const submit = handleSubmit((values) => {
    onSubmit?.({
      side,
      type: values.type,
      timeInForce: values.timeInForce,
      price: needsNoPrice(type) ? undefined : values.price,
      stopPrice: needsStopPrice ? values.stopPrice : undefined,
      quantity: values.quantity,
      reduceOnly: isFutures ? values.reduceOnly : undefined,
      leverage: isFutures && (maxLeverage ?? 1) > 1 ? Number(values.leverage) : undefined,
    });
  });

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-4', className)}>
      <SegmentedControl
        options={[
          { value: 'buy', label: 'Buy / Long' },
          { value: 'sell', label: isFutures ? 'Sell / Short' : 'Sell' },
        ]}
        value={side}
        onChange={setSide}
        className="w-full"
      />

      <div className="grid gap-3">
        <div>
          <Label>Order type</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(isFutures ? FUTURES_ORDER_TYPES : SPOT_ORDER_TYPES).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {needsStopPrice ? (
          <div>
            <Label htmlFor="order-stop-price">Stop price</Label>
            <Input
              id="order-stop-price"
              type="text"
              inputMode="decimal"
              className="mt-1.5"
              placeholder="0.00"
              {...register('stopPrice', { required: 'Stop price is required' })}
              error={errors.stopPrice?.message}
            />
          </div>
        ) : null}

        <div>
          <Label htmlFor="order-price">
            Price {isMarketOrder ? <span className="text-muted-foreground">(market)</span> : null}
          </Label>
          <Input
            id="order-price"
            type="text"
            inputMode="decimal"
            className="mt-1.5"
            placeholder={isMarketOrder ? 'Market price' : '0.00'}
            disabled={isMarketOrder}
            {...register('price', {
              required: isMarketOrder ? false : 'Price is required',
            })}
            error={errors.price?.message}
          />
        </div>

        <div>
          <Label htmlFor="order-quantity">
            Quantity ({instrument?.baseAsset ?? 'base'})
          </Label>
          <Input
            id="order-quantity"
            type="text"
            inputMode="decimal"
            className="mt-1.5"
            placeholder="0.00"
            {...register('quantity', {
              required: 'Quantity is required',
              validate: (v) => Number(v) > 0 || 'Quantity must be greater than zero',
            })}
            error={errors.quantity?.message}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Available</span>
            <span className="text-xs font-medium text-foreground">
              {currentAvailableBalance == null
                ? '—'
                : isFutures
                  ? formatCurrency(currentAvailableBalance, instrument?.quoteAsset ?? 'USD')
                    : `${formatQuantity(currentAvailableBalance, 6)} ${
                      side === 'buy' ? instrument?.quoteAsset ?? '' : instrument?.baseAsset ?? ''
                    }`}
            </span>
          </div>
          <div className="flex gap-1">
            {[25, 50, 75, 100].map((p) => (
              <Button
                key={p}
                type="button"
                variant={percent === p ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => applyPercent(p)}
              >
                {p}%
              </Button>
            ))}
          </div>
        </div>

        {!isMarketOrder ? (
          <div>
            <Label>Time in force</Label>
            <Controller
              control={control}
              name="timeInForce"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_IN_FORCE.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        ) : null}

        {isFutures ? (
          maxLeverage > 1 ? (
            <div>
              <div className="flex items-center justify-between">
                <Label>Leverage</Label>
                <span className="text-xs font-medium text-foreground">{leverage}x</span>
              </div>
              <Controller
                control={control}
                name="leverage"
                render={({ field }) => (
                  <Slider
                    value={[field.value]}
                    min={1}
                    max={maxLeverage}
                    step={1}
                    className="mt-3"
                    onValueChange={(v) => field.onChange(v[0])}
                  />
                )}
              />
              <p className="mt-1 text-2xs text-muted-foreground">
                Max {maxLeverage}x for this instrument
              </p>
            </div>
          ) : (
            <p className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Leverage is managed by the exchange. This ticket uses the selected account’s current
              leverage setting.
            </p>
          )
        ) : null}

        {isFutures ? (
          <div className="flex items-center justify-between">
            <div>
              <Label>Reduce only</Label>
              <p className="text-2xs text-muted-foreground">
                Only reduce an existing position
              </p>
            </div>
            <Controller
              control={control}
              name="reduceOnly"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>Estimated notional</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {formatCurrency(notional, instrument?.quoteAsset ?? 'USD')}
        </p>
        <p className="mt-1 text-2xs text-muted-foreground">
          {resolvedUsdConversionRate
            ? `${approximateUsdConversion ? 'Approx. ' : ''}${formatCurrency(
                notional * resolvedUsdConversionRate,
                'USD',
              )} USD`
            : 'USD estimate unavailable for this quote asset'}
        </p>
        <div
          className={cn(
            'mt-2 border-t border-border pt-2 text-2xs',
            orderPreview.sufficient === true
              ? 'text-success'
              : orderPreview.sufficient === false
                ? 'text-destructive'
                : 'text-muted-foreground',
          )}
          role="status"
        >
          {isBalancesLoading
            ? 'Refreshing account balances…'
            : orderPreview.sufficient === true
              ? `Sufficient ${orderPreview.requiredAsset} balance: ${formatQuantity(
                  orderPreview.availableBalance,
                  6,
                )} available; ${formatQuantity(orderPreview.requiredBalance, 6)} estimated required.`
              : orderPreview.sufficient === false
                ? `Insufficient ${orderPreview.requiredAsset} balance: ${formatQuantity(
                    orderPreview.availableBalance,
                    6,
                  )} available; ${formatQuantity(orderPreview.requiredBalance, 6)} estimated required.`
                : 'Balance could not be estimated from the latest sync; the exchange will verify funds before submission.'}
          {balanceFreshness === 'stale' ? ' Balance snapshot is stale.' : null}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || balanceKnownInsufficient}
        variant={side === 'buy' ? 'success' : 'destructive'}
        className="w-full"
      >
        {isSubmitting
          ? 'Submitting…'
          : side === 'buy'
            ? isFutures
              ? 'Open long'
              : 'Buy'
            : isFutures
              ? 'Open short'
              : 'Sell'}
      </Button>

      <p className="text-2xs text-muted-foreground">
        Submission requires all pre-trade checks to pass. The exchange remains authoritative for
        acceptance and execution.
      </p>
    </form>
  );
}

function needsNoPrice(type) {
  return type === 'market' || type === 'stop_market';
}
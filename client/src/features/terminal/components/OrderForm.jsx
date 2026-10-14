import { useMemo, useState } from 'react';
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
  maxLeverage,
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
      type: 'limit',
      timeInForce: 'GTC',
      price: '',
      quantity: '',
      stopPrice: '',
      reduceOnly: false,
      leverage: 1,
    },
  });

  const type = watch('type');
  const price = watch('price');
  const quantity = watch('quantity');
  const leverage = watch('leverage');

  const isMarketOrder = type === 'market' || type === 'stop_market';
  const needsStopPrice = type === 'stop_market' || type === 'stop_limit';

  const notional = useMemo(() => {
    if (!quantity) {
      return 0;
    }
    const refPrice = isMarketOrder ? Number(instrument?.markPrice ?? instrument?.lastPrice ?? 0) : Number(price);
    return Number(quantity) * (Number.isFinite(refPrice) ? refPrice : 0);
  }, [quantity, price, isMarketOrder, instrument]);

  const applyPercent = (nextPercent) => {
    setPercent(nextPercent);
    const base = isFutures ? availableMargin : availableBalance;
    if (!base || !instrument) {
      return;
    }
    const refPrice = isMarketOrder ? Number(instrument.markPrice ?? instrument.lastPrice ?? 0) : Number(price);
    if (!Number.isFinite(refPrice) || refPrice <= 0) {
      return;
    }
    const usable = Number(base) * (nextPercent / 100);
    const size = isFutures
      ? (usable * Number(leverage)) / refPrice
      : usable / refPrice;
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
      leverage: isFutures ? Number(values.leverage) : undefined,
    });
  });

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-4', className)}>
      <SegmentedControl
        options={[
          { value: 'buy', label: 'Buy / Long' },
          { value: 'sell', label: 'Sell / Short' },
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
              {isFutures
                ? formatCurrency(availableMargin ?? 0, instrument?.quoteAsset ?? 'USD')
                : `${formatQuantity(availableBalance ?? 0, 6)} ${instrument?.baseAsset ?? ''}`}
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
                  max={maxLeverage ?? 20}
                  step={1}
                  className="mt-3"
                  onValueChange={(v) => field.onChange(v[0])}
                />
              )}
            />
            {maxLeverage ? (
              <p className="mt-1 text-2xs text-muted-foreground">
                Max {maxLeverage}x for this instrument
              </p>
            ) : null}
          </div>
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
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
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
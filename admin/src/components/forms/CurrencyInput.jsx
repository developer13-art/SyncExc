import { Input } from '../ui/Input.jsx';

export function CurrencyInput({
  id,
  currency = 'USD',
  value,
  onChange,
  ...props
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-sm text-muted-foreground" aria-hidden="true">
        {currency}
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </div>
  );
}

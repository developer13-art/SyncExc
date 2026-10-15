import { Input } from '../ui/Input.jsx';

export function OtpInput({
  value = '',
  onChange,
  length = 6,
  autoFocus = false,
  disabled = false,
}) {
  const digits = String(value).replace(/\D/g, '').slice(0, length);

  return (
    <div className="flex flex-col items-center gap-2">
      <Input
        value={digits}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, length))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        maxLength={length}
        aria-label={`Enter ${length}-digit verification code`}
        className="w-52 text-center font-mono text-lg tracking-[0.5em]"
      />
      <span className="text-xs text-muted-foreground">
        {digits.length} of {length} digits
      </span>
    </div>
  );
}

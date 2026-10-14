import { Switch } from '../../../components/ui/Switch.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  mandatory,
  className,
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-border py-3 last:border-0',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {mandatory ? (
            <Badge variant="warning" size="sm">
              Mandatory
            </Badge>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled || mandatory}
      />
    </div>
  );
}
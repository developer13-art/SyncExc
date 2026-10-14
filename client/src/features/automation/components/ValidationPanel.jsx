import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { cn } from '../../../lib/utils/cn.util.js';

export function ValidationPanel({ result, onValidate, isValidating, className }) {
  if (!result && !onValidate) {
    return null;
  }

  const errors = result?.errors ?? [];
  const warnings = result?.warnings ?? [];
  const isValid = result?.valid === true;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Validation</p>
        {onValidate ? (
          <Button size="sm" variant="outline" onClick={onValidate} disabled={isValidating}>
            {isValidating ? 'Validating…' : 'Re-validate'}
          </Button>
        ) : null}
      </div>

      {isValid && errors.length === 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 p-3 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>Workflow passes structural validation. You can publish it when ready.</p>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {errors.map((error, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">{error.message ?? error}</p>
                {error.nodeId ? (
                  <p className="mt-0.5 text-2xs opacity-80">Node: {error.nodeId}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {warnings.map((warning, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{warning.message ?? warning}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
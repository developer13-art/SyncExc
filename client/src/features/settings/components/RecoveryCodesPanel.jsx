import { Copy, Download, RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { copyToClipboard } from '../../../lib/utils/clipboard.util.js';
import { downloadText } from '../../../lib/utils/download.util.js';
import { useToast } from '../../../hooks/useToast.js';

export function RecoveryCodesPanel({ codes = [], remaining, onRegenerate, isRegenerating }) {
  const toast = useToast();

  const handleCopy = async () => {
    const ok = await copyToClipboard(codes.join('\n'));
    if (ok) {
      toast.success('Codes copied');
    } else {
      toast.error('Unable to copy');
    }
  };

  const handleDownload = () => {
    downloadText(
      `SyncExc Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n${codes.join('\n')}\n\nKeep these codes in a safe place. Each code can be used once.`,
      'syncexc-recovery-codes.txt',
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recovery codes</CardTitle>
          {typeof remaining === 'number' ? (
            <Badge variant={remaining > 0 ? 'success' : 'destructive'}>
              {remaining} remaining
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {codes.length === 0 ? (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
            Recovery codes are only shown when generated. Regenerate them now if you have lost
            access to the previous set.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {codes.map((code, i) => (
              <code
                key={i}
                className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-center font-mono text-xs text-foreground"
              >
                {code}
              </code>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {codes.length > 0 ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </>
          ) : null}
          {onRegenerate ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {isRegenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          ) : null}
        </div>

        <p className="text-2xs text-muted-foreground">
          Regenerating recovery codes invalidates the previous set. Store them in a safe place
          — they are the only way to sign in if you lose access to your authenticator app.
        </p>
      </CardContent>
    </Card>
  );
}
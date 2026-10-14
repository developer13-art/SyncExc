import { AlertTriangle } from 'lucide-react';

import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';

export function DisconnectDialog({ open, onOpenChange, connection, onConfirm, isSubmitting }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Disconnect exchange"
      description={
        connection
          ? `You are about to disconnect "${connection.label ?? connection.exchangeName}".`
          : ''
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <p>
            Disconnecting removes SyncExc's ability to use this connection. It does not revoke
            the API key at the exchange. To revoke the key itself, use your exchange account
            settings.
          </p>
        </div>

        <ul className="ml-5 list-disc space-y-1.5 text-xs text-muted-foreground">
          <li>New operations that depend on this connection will stop.</li>
          <li>Active synchronization groups using this connection will be paused.</li>
          <li>Historical records are retained for audit and support.</li>
          <li>Sharing grants to other workspaces will be revoked.</li>
        </ul>
      </div>
    </Modal>
  );
}
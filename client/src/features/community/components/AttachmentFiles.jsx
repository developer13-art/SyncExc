import { useState } from 'react';
import { Download, FileText } from 'lucide-react';

import { communityApi } from '../../../api/index.js';
import { getErrorMessage } from '../../../api/errors.js';
import { cn } from '../../../lib/utils/cn.util.js';

export function AttachmentFiles({ attachments = [], className }) {
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const availableAttachments = attachments.filter((attachment) => attachment.id && attachment.url);

  if (!availableAttachments.length) return null;

  const download = async (attachment) => {
    setError('');
    setDownloadingId(attachment.id);
    try {
      const response = await communityApi.downloadAttachment(attachment.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name || 'attachment';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(getErrorMessage(downloadError));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className={cn('mt-2 flex flex-col gap-1.5', className)}>
      {availableAttachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          onClick={() => download(attachment)}
          disabled={downloadingId === attachment.id}
          className="inline-flex w-fit max-w-full items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-primary hover:bg-muted disabled:opacity-60"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{attachment.name || 'Attachment'}</span>
          <Download className="h-3.5 w-3.5 shrink-0" />
        </button>
      ))}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';

import { communityApi } from '../../../api/index.js';
import { getErrorMessage } from '../../../api/errors.js';
import { cn } from '../../../lib/utils/cn.util.js';

function ImagePreview({ attachment }) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl;

    communityApi.downloadAttachment(attachment.id)
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (active) setImageUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((downloadError) => {
        if (active) setError(getErrorMessage(downloadError));
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (error) {
    return <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>;
  }
  if (!imageUrl) {
    return <div className="mt-2 h-28 w-40 animate-pulse rounded-md bg-muted" aria-label="Loading image preview" />;
  }
  return (
    <img
      src={imageUrl}
      alt={attachment.name || 'Uploaded image'}
      className="mt-2 max-h-80 max-w-full rounded-md object-contain"
      loading="lazy"
    />
  );
}

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
    <div className={cn('mt-2 flex flex-col items-start gap-1.5', className)}>
      {availableAttachments.map((attachment) => (
        <div key={attachment.id} className="max-w-full">
          {attachment.mimeType?.startsWith('image/') ? (
            <ImagePreview attachment={attachment} />
          ) : null}
          <button
            type="button"
            onClick={() => download(attachment)}
            disabled={downloadingId === attachment.id}
            className="mt-1 inline-flex w-fit max-w-full items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-primary hover:bg-muted disabled:opacity-60"
          >
            {attachment.mimeType?.startsWith('image/') ? (
              <Download className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{attachment.name || 'Attachment'}</span>
            {downloadingId !== attachment.id ? (
              attachment.mimeType?.startsWith('image/') ? null : <Download className="h-3.5 w-3.5 shrink-0" />
            ) : null}
          </button>
        </div>
      ))}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

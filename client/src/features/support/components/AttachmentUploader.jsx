import { useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';

import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { formatFileSize } from '../../../lib/formatters/number.formatter.js';
import { cn } from '../../../lib/utils/cn.util.js';

const ACCEPT = '.png,.jpg,.jpeg,.pdf,.txt,.json,.csv';
const MAX_SIZE_MB = 10;

export function AttachmentUploader({
  attachments = [],
  onUpload,
  onRemove,
  disabled,
  className,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFiles = async (fileList) => {
    setError(null);
    const files = Array.from(fileList ?? []);

    for (const file of files) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${file.name} exceeds ${MAX_SIZE_MB} MB`);
        continue;
      }
    }

    setUploading(true);
    try {
      for (const file of files) {
        if (file.size <= MAX_SIZE_MB * 1024 * 1024) {
          await onUpload?.(file);
        }
      }
    } catch (err) {
      setError(err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Alert variant="warning" title="Never upload credentials">
        <p className="text-xs">
          Do not upload files containing passwords, API keys, private keys, MFA codes, or
          exchange secrets. Uploads are scanned and may be removed if they contain sensitive
          data.
        </p>
      </Alert>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) {
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-6 text-center transition',
          dragging && 'border-primary bg-primary/5',
          disabled && 'opacity-60',
        )}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag files here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-primary hover:underline"
            disabled={disabled}
          >
            browse
          </button>
        </p>
        <p className="text-2xs text-muted-foreground">
          PNG, JPEG, PDF, TXT, JSON, CSV · Max {MAX_SIZE_MB} MB per file
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || uploading}
        />
      </div>

      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{attachment.name}</span>
                {attachment.size !== undefined ? (
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </span>
                ) : null}
                {attachment.scanStatus === 'pending' ? (
                  <span className="text-2xs text-warning">Scanning…</span>
                ) : attachment.scanStatus === 'failed' ? (
                  <span className="text-2xs text-destructive">Rejected</span>
                ) : null}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove?.(attachment)}
                disabled={disabled}
                className="h-6 px-2"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
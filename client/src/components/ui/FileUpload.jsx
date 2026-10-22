import { useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';

import { cn } from '../../lib/utils/cn.util.js';
import { Button } from './Button.jsx';
import { formatFileSize } from '../../lib/formatters/number.formatter.js';

export function FileUpload({
  accept,
  multiple = false,
  maxSizeMb = 10,
  onChange,
  value = [],
  className,
  disabled = false,
  compact = false,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const files = Array.isArray(value) ? value : value ? [value] : [];

  const handleFiles = (fileList) => {
    const incoming = Array.from(fileList ?? []).filter(
      (f) => f.size <= maxSizeMb * 1024 * 1024,
    );
    if (incoming.length === 0) {
      return;
    }
    onChange?.(multiple ? [...files, ...incoming] : incoming[0]);
  };

  const removeFile = (index) => {
    if (multiple) {
      const next = files.filter((_, i) => i !== index);
      onChange?.(next);
    } else {
      onChange?.(null);
    }
  };

  if (compact) {
    return (
      <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = '';
          }}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Attach files"
          title={`Attach files (max ${maxSizeMb} MB each)`}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="shrink-0"
        >
          <Upload className="h-4 w-4" />
        </Button>
        {files.map((file, index) => (
          <span
            key={`${file.name}-${index}`}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-40 truncate">{file.name}</span>
            <span className="shrink-0 text-muted-foreground">{formatFileSize(file.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={() => removeFile(index)}
              disabled={disabled}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
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
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center transition',
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
          Max {maxSizeMb} MB {accept ? `· ${accept}` : ''}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
          disabled={disabled}
        />
      </div>

      {files.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="h-6 px-2"
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
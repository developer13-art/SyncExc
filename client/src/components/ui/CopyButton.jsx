import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { IconButton } from './IconButton.jsx';
import { copyToClipboard } from '../../lib/utils/clipboard.util.js';
import { useToast } from '../../hooks/useToast.js';

export function CopyButton({ value, label = 'Copy', className, size = 'sm' }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = async () => {
    const ok = await copyToClipboard(String(value ?? ''));
    if (!ok) {
      toast.error('Unable to copy to clipboard');
      return;
    }
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <IconButton
      label={label}
      size={size}
      onClick={handleCopy}
      className={className}
      disabled={value === undefined || value === null}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </IconButton>
  );
}
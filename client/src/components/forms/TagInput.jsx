import { useState } from 'react';
import { X } from 'lucide-react';

import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function TagInput({ value = [], onChange, placeholder = 'Type and press Enter', className }) {
  const [input, setInput] = useState('');

  const addTag = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    if (value.includes(trimmed)) {
      setInput('');
      return;
    }
    onChange?.([...value, trimmed]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      onChange?.(value.slice(0, -1));
    }
  };

  const remove = (tag) => {
    onChange?.(value.filter((t) => t !== tag));
  };

  return (
    <div
      className={cn(
        'flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 shadow-sm transition focus-within:ring-2 focus-within:ring-ring',
        className,
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
        >
          <span className="max-w-[12rem] truncate">{tag}</span>
          <button
            type="button"
            onClick={() => remove(tag)}
            className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={value.length === 0 ? placeholder : ''}
        className="h-6 flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
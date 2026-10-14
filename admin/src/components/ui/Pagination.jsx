import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { Button } from './Button.jsx';
import { IconButton } from './IconButton.jsx';
import { cn } from '../../lib/utils/cn.util.js';

export function Pagination({
  page,
  totalPages,
  onPageChange,
  hasNext,
  hasPrev,
  className,
  siblingCount = 1,
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = [];
  const start = Math.max(2, page - siblingCount);
  const end = Math.min(totalPages - 1, page + siblingCount);

  pages.push(1);
  if (start > 2) {
    pages.push('…');
  }
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (end < totalPages - 1) {
    pages.push('…');
  }
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return (
    <nav className={cn('flex items-center gap-1', className)} aria-label="Pagination">
      <IconButton
        label="First page"
        size="sm"
        onClick={() => onPageChange(1)}
        disabled={!hasPrev}
      >
        <ChevronsLeft className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label="Previous page"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </IconButton>

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ell-${i}`} className="px-2 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            size="sm"
            variant={p === page ? 'default' : 'ghost'}
            onClick={() => onPageChange(p)}
            className="min-w-8"
          >
            {p}
          </Button>
        ),
      )}

      <IconButton
        label="Next page"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label="Last page"
        size="sm"
        onClick={() => onPageChange(totalPages)}
        disabled={!hasNext}
      >
        <ChevronsRight className="h-3.5 w-3.5" />
      </IconButton>
    </nav>
  );
}
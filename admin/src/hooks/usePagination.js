import { useCallback, useMemo, useState } from 'react';

import { PAGINATION } from '../lib/constants/app.constants.js';

export function usePagination(options = {}) {
  const {
    initialPage = 1,
    initialPageSize = PAGINATION.DEFAULT_PAGE_SIZE,
    initialTotal = 0,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(initialTotal);

  const totalPages = useMemo(() => {
    if (total === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const nextPage = useCallback(() => {
    setPage((current) => Math.min(current + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  const goToPage = useCallback(
    (target) => {
      const clamped = Math.max(1, Math.min(target, totalPages));
      setPage(clamped);
    },
    [totalPages],
  );

  const changePageSize = useCallback((size) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setPage(initialPage);
    setTotal(0);
  }, [initialPage]);

  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    total,
    totalPages,
    offset,
    hasNext,
    hasPrev,
    nextPage,
    prevPage,
    goToPage,
    changePageSize,
    setTotal,
    reset,
  };
}
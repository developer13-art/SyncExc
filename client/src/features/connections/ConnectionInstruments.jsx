import { useState } from 'react';

import { DataTable } from '../../components/ui/DataTable.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useQuery } from '@tanstack/react-query';
import { connectionsApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useDebounce } from '../../hooks/useDebounce.js';

export function ConnectionInstruments({ connectionId }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const instrumentsQuery = useQuery({
    queryKey: queryKeys.connections.instruments({ connectionId, q: debouncedQuery }),
    queryFn: () => connectionsApi.listExchangeInstruments({ connectionId, q: debouncedQuery }),
    enabled: Boolean(connectionId),
    staleTime: 5 * 60_000,
  });

  const instruments = instrumentsQuery.data?.items ?? instrumentsQuery.data ?? [];

  const columns = [
    {
      key: 'symbol',
      label: 'Symbol',
      render: (row) => <span className="font-medium text-foreground">{row.symbol}</span>,
    },
    { key: 'baseAsset', label: 'Base' },
    { key: 'quoteAsset', label: 'Quote' },
    {
      key: 'marketType',
      label: 'Market',
      render: (row) => <Badge variant="muted">{row.marketType ?? 'spot'}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'muted'}>
          {row.status ?? 'active'}
        </Badge>
      ),
    },
    {
      key: 'quantityPrecision',
      label: 'Qty precision',
      align: 'right',
      render: (row) => row.quantityPrecision ?? '—',
    },
    {
      key: 'pricePrecision',
      label: 'Price precision',
      align: 'right',
      render: (row) => row.pricePrecision ?? '—',
    },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search instruments…"
          className="w-full max-w-xs"
        />
      </div>

      <DataTable
        columns={columns}
        rows={instruments}
        isLoading={instrumentsQuery.isLoading}
        emptyTitle="No instruments found"
        emptyDescription="Try a different search query."
      />
    </>
  );
}
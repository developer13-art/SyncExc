import { SearchInput } from '../../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../../components/navigation/SegmentedControl.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Check } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'trading', label: 'Trading' },
  { value: 'sync', label: 'Synchronization' },
  { value: 'risk', label: 'Risk' },
  { value: 'signals', label: 'Signals' },
  { value: 'billing', label: 'Billing' },
  { value: 'security', label: 'Security' },
  { value: 'support', label: 'Support' },
  { value: 'community', label: 'Community' },
  { value: 'system', label: 'System' },
];

export function NotificationFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  onMarkAllRead,
  unreadCount,
  isMarkingAllRead,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search notifications…"
        className="w-full max-w-xs"
      />

      <SegmentedControl options={STATUS_OPTIONS} value={status} onChange={onStatusChange} />

      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <div className="ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onMarkAllRead}
          disabled={isMarkingAllRead || unreadCount === 0}
        >
          <Check className="h-3.5 w-3.5" />
          {isMarkingAllRead ? 'Marking…' : 'Mark all read'}
        </Button>
      </div>
    </div>
  );
}
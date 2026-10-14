import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { GroupCard } from './components/GroupCard.jsx';
import { useCommunityGroups } from '../../hooks/useCommunity.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'My groups' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

export default function Groups() {
  const dispatch = useDispatch();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Groups'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'Groups', path: ROUTES.app.community.groups },
      ]),
    );
  }, [dispatch]);

  const groupsQuery = useCommunityGroups({
    filter: filter === 'all' ? undefined : filter,
    q: query || undefined,
  });

  const groups = groupsQuery.groups ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join communities or create your own. Group roles are separate from workspace and
            trading permissions.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.app.community.createGroup}>
            <Plus className="h-4 w-4" /> Create group
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search groups…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {groupsQuery.isLoading ? (
        <LoadingState label="Loading groups" />
      ) : groupsQuery.isError ? (
        <ErrorState
          title="Unable to load groups"
          description="We could not fetch your groups."
          onRetry={groupsQuery.refetch}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query || filter !== 'all' ? 'No matching groups' : 'No groups yet'}
          description={
            query || filter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Be the first to create a community for your interests.'
          }
          action={
            !query && filter === 'all' ? (
              <Button asChild>
                <Link to={ROUTES.app.community.createGroup}>Create group</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
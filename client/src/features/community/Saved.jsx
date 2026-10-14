import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Bookmark } from 'lucide-react';

import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { PostCard } from './components/PostCard.jsx';
import { useQuery } from '@tanstack/react-query';
import { communityApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Saved() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Saved Items'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'Saved', path: ROUTES.app.community.saved },
      ]),
    );
  }, [dispatch]);

  const savedQuery = useQuery({
    queryKey: queryKeys.community.savedItems({}),
    queryFn: () => communityApi.listSavedItems({}),
  });

  const items = savedQuery.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Saved Items</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved posts are references, not copies. If the original is deleted or becomes
          inaccessible, the saved reference reflects that.
        </p>
      </div>

      {savedQuery.isLoading ? (
        <LoadingState label="Loading saved items" />
      ) : savedQuery.isError ? (
        <ErrorState
          title="Unable to load saved items"
          description="We could not fetch your saved items."
          onRetry={savedQuery.refetch}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved items"
          description="Bookmark posts to save them for later."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) =>
            item.post ? <PostCard key={item.id} post={item.post} /> : null,
          )}
        </div>
      )}
    </div>
  );
}
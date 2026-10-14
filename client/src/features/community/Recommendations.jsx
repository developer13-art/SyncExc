import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { RecommendationCard } from './components/RecommendationCard.jsx';
import { GroupCard } from './components/GroupCard.jsx';
import { useCommunityRecommendations } from '../../hooks/useCommunity.js';
import { communityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Recommendations() {
  const dispatch = useDispatch();
  const toast = useToast();
  const recommendationsQuery = useCommunityRecommendations({});

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Recommendations'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'Recommendations', path: ROUTES.app.community.recommendations },
      ]),
    );
  }, [dispatch]);

  const isLoading = recommendationsQuery.isLoading;

  const handleFollow = async (recommendation) => {
    try {
      await communityApi.follow(recommendation.userId, {});
      toast.success('Following');
      recommendationsQuery.submitFeedback({
        userId: recommendation.userId,
        feedback: 'accepted',
      });
    } catch (err) {
      toast.error('Follow failed', { description: getErrorMessage(err) });
    }
  };

  const handleDismiss = (recommendation) => {
    recommendationsQuery.submitFeedback({
      userId: recommendation.userId,
      feedback: 'dismissed',
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Recommendations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suggestions for people and communities based on your selected interests and
            permitted activity. Every recommendation includes an explanation.
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Loading recommendations" />
      ) : recommendationsQuery.isError ? (
        <ErrorState
          title="Unable to load recommendations"
          description="We could not fetch recommendations."
          onRetry={recommendationsQuery.refetch}
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>People to follow</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendationsQuery.people.length === 0 ? (
                <EmptyState
                  title="No people recommendations"
                  description="Add interests to your profile to receive suggestions."
                  size="sm"
                  className="border-0 bg-transparent py-4"
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {recommendationsQuery.people.map((rec) => (
                    <RecommendationCard
                      key={rec.userId}
                      recommendation={rec}
                      onAction={handleFollow}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Groups for you</CardTitle>
            </CardHeader>
            <CardContent>
              {recommendationsQuery.groups.length === 0 ? (
                <EmptyState
                  title="No group recommendations"
                  description="Join or follow topics to receive group suggestions."
                  size="sm"
                  className="border-0 bg-transparent py-4"
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {recommendationsQuery.groups.map((group) => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
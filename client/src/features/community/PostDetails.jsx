import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { PostCard } from './components/PostCard.jsx';
import { CommentThread } from './components/CommentThread.jsx';
import { PostStructuredContent } from './components/PostStructuredContent.jsx';
import { ReportDialog } from './components/ReportDialog.jsx';
import { useCommunityPost, useCommunityProfile } from '../../hooks/useCommunity.js';
import { communityApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function PostDetails() {
  const { postId } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const profileQuery = useCommunityProfile();
  const postQuery = useCommunityPost(postId);
  const [reportTarget, setReportTarget] = useState(null);

  useEffect(() => {
    if (postQuery.post) {
      dispatch(uiActions.setPageTitle('Post'));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Community', path: ROUTES.app.community.overview },
          { label: 'Post', path: ROUTES.app.community.post(postId) },
        ]),
      );
    }
  }, [postQuery.post, dispatch, postId]);

  if (postQuery.isLoading) {
    return <LoadingState label="Loading post" />;
  }

  if (postQuery.error || !postQuery.post) {
    return (
      <ErrorState
        title="Unable to load post"
        description="This post could not be retrieved."
        onRetry={postQuery.refetch}
      />
    );
  }

  const handleReply = async ({ parentId, content }) => {
    try {
      await postQuery.addComment({ parentId, content });
      toast.success('Reply posted');
      postQuery.refetch?.();
    } catch (err) {
      toast.error('Reply failed', { description: getErrorMessage(err) });
      throw err;
    }
  };

  const handleDelete = async (comment) => {
    try {
      await communityApi.deleteComment(comment.id);
      toast.success('Comment removed');
      postQuery.refetch?.();
    } catch (err) {
      toast.error('Delete failed', { description: getErrorMessage(err) });
    }
  };

  const submitReport = async ({ reason, details }) => {
    try {
      await communityApi.submitReport({
        resourceType: reportTarget.type,
        resourceId: reportTarget.id,
        reason,
        details,
      });
      toast.success('Report submitted');
      setReportTarget(null);
    } catch (err) {
      toast.error('Report failed', { description: getErrorMessage(err) });
      throw err;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.community.feed}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <PostCard
        post={postQuery.post}
        currentUserId={profileQuery.profile?.userId}
        onReport={(post) => setReportTarget({ type: 'post', id: post.id })}
      />

      <PostStructuredContent post={postQuery.post} onRefresh={postQuery.refetch} />

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentThread
            comments={postQuery.comments}
            currentUserId={profileQuery.profile?.userId}
            onReply={handleReply}
            onDelete={handleDelete}
            onReport={(comment) => setReportTarget({ type: 'comment', id: comment.id })}
          />
        </CardContent>
      </Card>
      <ReportDialog
        open={Boolean(reportTarget)}
        onOpenChange={(open) => { if (!open) setReportTarget(null); }}
        onSubmit={submitReport}
      />
    </div>
  );
}
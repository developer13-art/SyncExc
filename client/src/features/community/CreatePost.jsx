import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { PostComposer } from './components/PostComposer.jsx';
import { useCommunityPosts, useCommunityProfile } from '../../hooks/useCommunity.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CreatePost() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const profileQuery = useCommunityProfile();
  const postsQuery = useCommunityPosts({});

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Create Post'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'New post', path: ROUTES.app.community.createPost },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (values) => {
    try {
      const created = await postsQuery.createPost(values);
      toast.success('Posted');
      navigate(ROUTES.app.community.post(created.id), { replace: true });
    } catch (err) {
      toast.error('Failed to post', { description: getErrorMessage(err) });
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Create post
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Posts are informational. They never trigger trades or override execution controls.
            </p>
          </div>
          <PostComposer
            user={profileQuery.profile}
            defaultDestination="public"
            onSubmit={handleSubmit}
            onCancel={() => navigate(ROUTES.app.community.feed)}
          />
        </div>
        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" /> Make it useful
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Add context, explain your reasoning, and use topics so other members can find your
              post.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" /> Community guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Keep discussions respectful. Don’t share private information or present an idea as
              a guaranteed result.
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
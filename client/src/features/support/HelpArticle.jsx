import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ThumbsDown, ThumbsUp } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { useHelpArticle } from '../../hooks/useSupport.js';
import { supportApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { formatDate } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

export default function HelpArticle() {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const articleQuery = useHelpArticle(slug);

  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (articleQuery.data) {
      dispatch(uiActions.setPageTitle(articleQuery.data.title));
      dispatch(
        uiActions.setBreadcrumbs([
          { label: 'Support', path: ROUTES.app.support.overview },
          { label: 'Help center', path: ROUTES.app.support.help },
          {
            label: articleQuery.data.title,
            path: ROUTES.app.support.helpArticle(slug),
          },
        ]),
      );
    }
  }, [articleQuery.data, dispatch, slug]);

  if (articleQuery.isLoading) {
    return <LoadingState label="Loading article" />;
  }

  if (articleQuery.error || !articleQuery.data) {
    return (
      <ErrorState
        title="Unable to load article"
        description="This help article could not be retrieved."
        onRetry={articleQuery.refetch}
      />
    );
  }

  const article = articleQuery.data;

  const handleFeedback = async (helpful) => {
    setSubmitting(true);
    try {
      await supportApi.submitHelpFeedback(article.id, {
        helpful,
        comment: feedbackComment.trim() || undefined,
      });
      setFeedbackGiven(helpful);
      toast.success('Thanks for your feedback');
    } catch (err) {
      toast.error('Feedback failed', { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.support.help}>
            <ArrowLeft className="h-4 w-4" /> Back to help center
          </Link>
        </Button>
      </div>

      <article className="mx-auto w-full max-w-3xl">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {article.title}
            </h1>
            {article.category ? (
              <Badge variant="muted">{article.category}</Badge>
            ) : null}
          </div>
          {article.summary ? (
            <p className="mt-2 text-sm text-muted-foreground">{article.summary}</p>
          ) : null}
          <p className="mt-2 text-2xs text-muted-foreground">
            {article.lastReviewedAt
              ? `Last reviewed ${formatDate(article.lastReviewedAt)}`
              : ''}
            {article.version ? ` · v${article.version}` : ''}
          </p>
        </header>

        <Card className="mt-6">
          <CardContent className="prose prose-sm max-w-none whitespace-pre-wrap break-words p-8 pt-8 text-sm text-foreground">
            {article.content}
          </CardContent>
        </Card>

        {article.relatedArticles?.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Related articles
            </h2>
            <ul className="flex flex-col gap-2">
              {article.relatedArticles.map((related) => (
                <li key={related.id}>
                  <Link
                    to={ROUTES.app.support.helpArticle(related.slug ?? related.id)}
                    className="block rounded-md border border-border px-4 py-3 text-sm text-foreground transition hover:border-primary/40"
                  >
                    {related.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Card className="mt-8">
          <CardContent className="p-6 pt-6">
            {feedbackGiven !== null ? (
              <p className="text-center text-sm text-muted-foreground">
                Thank you for your feedback.
              </p>
            ) : (
              <>
                <p className="text-center text-sm font-medium text-foreground">
                  Was this article helpful?
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleFeedback(true)}
                    disabled={submitting}
                  >
                    <ThumbsUp className="h-4 w-4" /> Yes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleFeedback(false)}
                    disabled={submitting}
                  >
                    <ThumbsDown className="h-4 w-4" /> No
                  </Button>
                </div>
                <Textarea
                  rows={2}
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Optional comment"
                  className="mt-3"
                />
              </>
            )}
          </CardContent>
        </Card>
      </article>
    </div>
  );
}
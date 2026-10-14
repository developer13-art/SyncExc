import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Star } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { useToast } from '../../hooks/useToast.js';
import { supportApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { cn } from '../../lib/utils/cn.util.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Feedback() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('ticketId');

  const [rating, setRating] = useState(0);
  const [resolved, setResolved] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Support Feedback'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Support', path: ROUTES.app.support.overview },
        { label: 'Feedback', path: ROUTES.app.support.feedback },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    setSubmitting(true);
    try {
      if (ticketId) {
        await supportApi.submitFeedback(ticketId, {
          rating,
          resolved,
          comment: comment.trim() || undefined,
        });
      }
      setSubmitted(true);
      toast.success('Thank you for your feedback');
    } catch (err) {
      toast.error('Submission failed', { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Thank you for your feedback
            </p>
            <p className="text-xs text-muted-foreground">
              Your responses help us improve the support experience.
            </p>
            <Button variant="outline" asChild>
              <Link to={ROUTES.app.support.overview}>Back to support</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>How was your support experience?</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">Overall satisfaction</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    aria-label={`${value} star${value !== 1 ? 's' : ''}`}
                    className="rounded-md p-1 transition hover:bg-muted"
                  >
                    <Star
                      className={cn(
                        'h-6 w-6',
                        value <= rating
                          ? 'fill-warning text-warning'
                          : 'text-muted-foreground',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <FormField label="Was the issue resolved?">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={resolved ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setResolved(true)}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={!resolved ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setResolved(false)}
                >
                  No
                </Button>
              </div>
            </FormField>

            <FormField
              label="Optional comment"
              htmlFor="feedback-comment"
              hint="Your feedback is separate from any product issues you reported."
            >
              <Textarea
                id="feedback-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </FormField>

            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <Link to={ROUTES.app.support.overview}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={submitting || rating === 0}>
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
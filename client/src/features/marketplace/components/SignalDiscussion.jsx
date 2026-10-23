import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { marketplaceApi } from '../../../api/index.js';
import { getErrorMessage } from '../../../api/errors.js';
import { apiConfig } from '../../../config/api.config.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { LoadingState } from '../../../components/ui/LoadingState.jsx';
import { useToast } from '../../../hooks/useToast.js';

export function SignalDiscussion({ signalId }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [proof, setProof] = useState(null);
  const queryKey = ['marketplace', 'signal-comments', signalId];

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => marketplaceApi.listSignalComments(signalId),
    enabled: Boolean(signalId),
  });

  const createComment = useMutation({
    mutationFn: () => marketplaceApi.createSignalComment(signalId, { content, proof }),
    onSuccess: async () => {
      setContent('');
      setProof(null);
      await queryClient.invalidateQueries({ queryKey });
      toast.success('Comment posted');
    },
  });

  const submit = (event) => {
    event.preventDefault();
    if (!content.trim() && !proof) return;
    createComment.mutate();
  };

  return (
    <section className="grid gap-4" aria-label="Signal comments">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Comments and winnings</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Share a comment or attach an image. Uploaded proof is visible only to this Trader and active subscribers.
        </p>
      </div>

      {commentsQuery.isLoading ? <LoadingState label="Loading comments" /> : null}
      {commentsQuery.isError ? (
        <p className="text-sm text-destructive" role="alert">{getErrorMessage(commentsQuery.error)}</p>
      ) : null}
      {commentsQuery.data?.length ? (
        <ul className="grid gap-3">
          {commentsQuery.data.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold text-foreground">
                {comment.author?.displayName || comment.author?.username || 'Subscriber'}
                <span className="ml-2 font-normal text-muted-foreground">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
                </span>
              </p>
              {comment.content ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.content}</p>
              ) : null}
              {comment.proof?.url ? (
                <img
                  src={`${apiConfig.baseURL}${comment.proof.url}`}
                  alt={`${comment.author?.displayName || 'Subscriber'} winnings proof`}
                  className="mt-3 max-h-80 rounded-md border border-border object-contain"
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!commentsQuery.isLoading && !commentsQuery.isError && !commentsQuery.data?.length ? (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      ) : null}

      <form className="grid gap-3" onSubmit={submit}>
        <textarea
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          maxLength={5000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a comment…"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <label htmlFor={`signal-proof-${signalId}`} className="text-xs text-muted-foreground">
              Optional winnings image (JPEG, PNG, or WebP; max 5 MB)
            </label>
            <Input
              id={`signal-proof-${signalId}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setProof(event.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            type="submit"
            disabled={createComment.isPending || (!content.trim() && !proof)}
          >
            {createComment.isPending ? 'Posting…' : 'Post comment'}
          </Button>
        </div>
        {createComment.isError ? (
          <p className="text-sm text-destructive" role="alert">{getErrorMessage(createComment.error)}</p>
        ) : null}
      </form>
    </section>
  );
}

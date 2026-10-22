import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';

import { communityApi } from '../../api/index.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FileUpload } from '../../components/ui/FileUpload.jsx';
import { AttachmentFiles } from './components/AttachmentFiles.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { useAuth } from '../../hooks/useAuth.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { formatDateTime } from '../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../config/routes.config.js';

function errorMessage(error) {
  return error?.response?.data?.error?.message || error?.message || 'Something went wrong.';
}

export default function Messages() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const recipientId = searchParams.get('recipientId') || '';
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [recipient, setRecipient] = useState(recipientId);

  useEffect(() => {
    setRecipient(recipientId);
  }, [recipientId]);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Messages'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Community', path: ROUTES.app.community.overview },
      { label: 'Messages', path: ROUTES.app.community.messages },
    ]));
  }, [dispatch]);

  const conversationsQuery = useQuery({
    queryKey: queryKeys.community.messageConversations({}),
    queryFn: () => communityApi.listMessageConversations({}),
    staleTime: 15_000,
  });
  const requestsQuery = useQuery({
    queryKey: queryKeys.community.messageRequests,
    queryFn: () => communityApi.listMessageRequests(),
    staleTime: 15_000,
  });
  const messagesQuery = useQuery({
    queryKey: queryKeys.community.directMessages(conversationId, {}),
    queryFn: () => communityApi.listDirectMessages(conversationId, {}),
    enabled: Boolean(conversationId),
    refetchInterval: 10_000,
  });

  const refreshLists = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['community', 'message-conversations'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.community.messageRequests }),
    ]);
  };

  const startMessage = useMutation({
    mutationFn: ({ content, attachmentIds }) =>
      communityApi.startMessageConversation({
        recipientId: recipient.trim(),
        content,
        attachmentIds,
      }),
    onSuccess: async (result) => {
      setDraft('');
      setFiles([]);
      await refreshLists();
      navigate(ROUTES.app.community.messageConversation(result.conversation.id));
    },
  });
  const sendMessage = useMutation({
    mutationFn: ({ content, attachmentIds }) =>
      communityApi.sendDirectMessage(conversationId, { content, attachmentIds }),
    onSuccess: async () => {
      setDraft('');
      setFiles([]);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.community.directMessages(conversationId, {}),
      });
      await queryClient.invalidateQueries({
        queryKey: ['community', 'message-conversations'],
      });
    },
  });
  const resolveRequest = useMutation({
    mutationFn: ({ id, accepted }) => communityApi.resolveMessageRequest(id, accepted),
    onSuccess: async (_, variables) => {
      await refreshLists();
      if (variables.accepted) {
        navigate(ROUTES.app.community.messageConversation(variables.id));
      } else if (conversationId === variables.id) {
        navigate(ROUTES.app.community.messages);
      }
    },
  });

  if (conversationsQuery.isLoading || requestsQuery.isLoading) {
    return <LoadingState label="Loading messages" />;
  }
  if (conversationsQuery.isError || requestsQuery.isError) {
    return (
      <ErrorState
        title="Unable to load messages"
        description="Your conversations could not be retrieved."
        onRetry={() => {
          conversationsQuery.refetch();
          requestsQuery.refetch();
        }}
      />
    );
  }

  const conversations = conversationsQuery.data?.items ?? [];
  const requests = requestsQuery.data ?? [];
  const selectedConversation = conversations.find((item) => item.id === conversationId);
  const selectedRequest = requests.find((item) => item.id === conversationId);
  const messages = messagesQuery.data?.items ?? [];
  const isMessageRequest = Boolean(selectedRequest);

  const submit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content && files.length === 0) return;
    const attachmentIds = [];
    setUploadError('');
    try {
      for (const file of files) {
        const uploaded = await communityApi.uploadAttachment(file);
        attachmentIds.push(uploaded.id);
      }
      if (conversationId) {
        await sendMessage.mutateAsync({ content, attachmentIds });
      } else if (recipient.trim()) {
        await startMessage.mutateAsync({ content, attachmentIds });
      }
    } catch (error) {
      await Promise.allSettled(
        attachmentIds.map((id) => communityApi.deletePendingAttachment(id))
      );
      setUploadError(errorMessage(error));
    }
  };

  const mutationError = startMessage.error || sendMessage.error || resolveRequest.error;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {requests.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Message requests
              </h2>
              {requests.map((request) => (
                <div key={request.id} className="rounded-md border border-border p-3">
                  <button
                    type="button"
                    className="w-full text-left text-sm font-medium text-foreground hover:underline"
                    onClick={() => navigate(ROUTES.app.community.messageConversation(request.id))}
                  >
                    {request.other_display_name || request.other_handle}
                  </button>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {request.initial_message}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => resolveRequest.mutate({ id: request.id, accepted: true })}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveRequest.mutate({ id: request.id, accepted: false })}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conversations
            </h2>
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground">No accepted conversations yet.</p>
            ) : conversations.map((conversation) => (
              <Link
                key={conversation.id}
                to={ROUTES.app.community.messageConversation(conversation.id)}
                className="rounded-md border border-border p-3 hover:bg-muted/40"
              >
                <span className="block text-sm font-medium text-foreground">
                  {conversation.other_display_name || conversation.other_handle}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {conversation.last_message || 'No messages'}
                </span>
              </Link>
            ))}
          </section>
        </CardContent>
      </Card>

      <Card className="min-h-[520px]">
        <CardHeader>
          <CardTitle>
            {selectedConversation?.other_display_name ||
              selectedRequest?.other_display_name ||
              (recipient ? 'New message request' : 'Choose a conversation')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[440px] flex-col gap-4">
          {mutationError ? (
            <p role="alert" className="text-xs text-destructive">
              {errorMessage(mutationError)}
            </p>
          ) : null}
          {uploadError ? <p role="alert" className="text-xs text-destructive">{uploadError}</p> : null}
          {conversationId && messagesQuery.isError ? (
            <ErrorState
              title="Unable to load this conversation"
              description="It may have been closed or you may not have access."
              onRetry={messagesQuery.refetch}
            />
          ) : null}
          {conversationId && messagesQuery.isLoading ? <LoadingState label="Loading messages" /> : null}
          {isMessageRequest ? (
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Accept this request to reply. Declining prevents further messages.
            </div>
          ) : null}
          {recipient && !conversationId ? (
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Send a message request to this profile. They must accept before replying.
            </div>
          ) : null}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.sender_id === user?.id
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'mr-auto bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <AttachmentFiles attachments={message.attachments} className="text-primary" />
                <time className="mt-1 block text-right text-[10px] opacity-70">
                  {message.created_at ? formatDateTime(message.created_at) : ''}
                </time>
              </div>
            ))}
          </div>
          {recipient && !conversationId ? (
            <label className="text-xs text-muted-foreground">
              Recipient user ID
              <Input value={recipient} onChange={(event) => setRecipient(event.target.value)} />
            </label>
          ) : null}
          {(!conversationId || (selectedConversation && !isMessageRequest)) ? (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <Textarea
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message"
                maxLength={10000}
                aria-label="Message"
              />
              <FileUpload
                accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv"
                multiple
                maxSizeMb={25}
                value={files}
                onChange={setFiles}
                disabled={startMessage.isPending || sendMessage.isPending}
              />
              <Button
                type="submit"
                disabled={(!draft.trim() && files.length === 0) || (!conversationId && !recipient.trim()) ||
                  startMessage.isPending || sendMessage.isPending}
                className="self-end"
              >
                <Send className="mr-2 h-4 w-4" />
                {startMessage.isPending || sendMessage.isPending ? 'Sending…' : 'Send'}
              </Button>
            </form>
          ) : null}
          {isMessageRequest ? (
            <div className="flex gap-2">
              <Button onClick={() => resolveRequest.mutate({ id: conversationId, accepted: true })}>
                Accept request
              </Button>
              <Button
                variant="outline"
                onClick={() => resolveRequest.mutate({ id: conversationId, accepted: false })}
              >
                Decline
              </Button>
            </div>
          ) : null}
          {!conversationId && !recipient ? (
            <div className="mt-auto text-sm text-muted-foreground">
              Open a profile and choose <strong>Message</strong> to start a conversation.
              <Button variant="ghost" size="sm" asChild className="ml-2">
                <Link to={ROUTES.app.community.discover}><ArrowLeft className="mr-1 h-3 w-3" /> Discover</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

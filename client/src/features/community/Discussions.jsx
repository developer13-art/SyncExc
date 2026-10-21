import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Send } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { communityApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Discussions() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [channelId, setChannelId] = useState('');
  const [threadId, setThreadId] = useState('');
  const [channelName, setChannelName] = useState('');
  const [threadTitle, setThreadTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const channelsQuery = useQuery({
    queryKey: ['community', 'discussion-channels'],
    queryFn: () => communityApi.listDiscussionChannels(),
  });
  const channels = channelsQuery.data ?? [];

  useEffect(() => {
    if (!channelId && channels.length > 0) setChannelId(channels[0].id);
  }, [channels, channelId]);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Discussions'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Community', path: ROUTES.app.community.overview },
      { label: 'Discussions', path: ROUTES.app.community.discussions },
    ]));
  }, [dispatch]);

  const threadsQuery = useQuery({
    queryKey: ['community', 'discussion-threads', channelId],
    queryFn: () => communityApi.listDiscussionThreads(channelId),
    enabled: Boolean(channelId),
  });

  useEffect(() => {
    const threads = threadsQuery.data?.items ?? [];
    if (!threads.some((thread) => thread.id === threadId)) {
      setThreadId(threads[0]?.id ?? '');
    }
  }, [threadsQuery.data, threadId]);

  const messagesQuery = useQuery({
    queryKey: ['community', 'discussion-messages', threadId],
    queryFn: () => communityApi.listDiscussionMessages(threadId),
    enabled: Boolean(threadId),
    refetchInterval: 10_000,
  });

  const invalidateThreads = () =>
    queryClient.invalidateQueries({ queryKey: ['community', 'discussion-threads', channelId] });
  const invalidateMessages = () =>
    queryClient.invalidateQueries({ queryKey: ['community', 'discussion-messages', threadId] });

  const handleCreateChannel = async (event) => {
    event.preventDefault();
    if (!channelName.trim()) return;
    setBusy(true);
    try {
      const channel = await communityApi.createDiscussionChannel({
        name: channelName.trim(),
        kind: 'general',
      });
      setChannelName('');
      setChannelId(channel.id);
      await queryClient.invalidateQueries({ queryKey: ['community', 'discussion-channels'] });
      toast.success('Channel created');
    } catch (error) {
      toast.error('Could not create channel', { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateThread = async (event) => {
    event.preventDefault();
    if (!threadTitle.trim() || !channelId) return;
    setBusy(true);
    try {
      const thread = await communityApi.createDiscussionThread(channelId, {
        title: threadTitle.trim(),
      });
      setThreadTitle('');
      await invalidateThreads();
      setThreadId(thread.id);
    } catch (error) {
      toast.error('Could not start discussion', { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!message.trim() || !threadId) return;
    setBusy(true);
    try {
      await communityApi.createDiscussionMessage(threadId, { content: message.trim() });
      setMessage('');
      await invalidateMessages();
    } catch (error) {
      toast.error('Message failed', { description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  if (channelsQuery.isLoading) return <LoadingState label="Loading discussions" />;
  if (channelsQuery.isError) {
    return (
      <ErrorState
        title="Unable to load discussions"
        description="Select an active workspace and try again."
        onRetry={channelsQuery.refetch}
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[15rem_19rem_minmax(0,1fr)]">
      <Card>
        <CardHeader><CardTitle>Channels</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {channels.map((channel) => (
            <Button
              key={channel.id}
              variant={channel.id === channelId ? 'secondary' : 'ghost'}
              className="justify-start"
              onClick={() => {
                setChannelId(channel.id);
                setThreadId('');
              }}
            >
              # {channel.name}
            </Button>
          ))}
          <form onSubmit={handleCreateChannel} className="flex gap-2 border-t border-border pt-3">
            <Input
              value={channelName}
              onChange={(event) => setChannelName(event.target.value)}
              placeholder="New channel"
              aria-label="New channel name"
              maxLength={100}
            />
            <Button type="submit" size="icon" disabled={busy || !channelName.trim()} aria-label="Create channel">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Topics</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {threadsQuery.isLoading ? <LoadingState label="Loading topics" /> : null}
          {threadsQuery.isError ? (
            <ErrorState title="Unable to load topics" description="Try again." onRetry={threadsQuery.refetch} />
          ) : null}
          {(threadsQuery.data?.items ?? []).map((thread) => (
            <Button
              key={thread.id}
              variant={thread.id === threadId ? 'secondary' : 'ghost'}
              className="justify-start text-left"
              onClick={() => setThreadId(thread.id)}
            >
              <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">{thread.title}</span>
            </Button>
          ))}
          {channelId ? (
            <form onSubmit={handleCreateThread} className="flex gap-2 border-t border-border pt-3">
              <Input
                value={threadTitle}
                onChange={(event) => setThreadTitle(event.target.value)}
                placeholder="Start a topic"
                aria-label="Discussion topic"
                maxLength={200}
              />
              <Button type="submit" size="icon" disabled={busy || !threadTitle.trim()} aria-label="Create topic">
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card className="min-h-[28rem]">
        <CardHeader>
          <CardTitle>
            {(threadsQuery.data?.items ?? []).find((thread) => thread.id === threadId)?.title ?? 'Messages'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[24rem] flex-col">
          {!threadId ? (
            <EmptyState title="Choose a topic" description="Select a discussion or start a new one." />
          ) : messagesQuery.isLoading ? (
            <LoadingState label="Loading messages" />
          ) : messagesQuery.isError ? (
            <ErrorState title="Unable to load messages" description="Try again." onRetry={messagesQuery.refetch} />
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto">
                {(messagesQuery.data?.items ?? []).map((item) => (
                  <div key={item.id} className="rounded-md bg-muted/50 p-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{item.content}</p>
                    <p className="mt-1 text-2xs text-muted-foreground">
                      {item.author_name ?? 'Member'} · {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                ))}
                {(messagesQuery.data?.items ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
                ) : null}
              </div>
              <form onSubmit={handleSendMessage} className="mt-3 flex items-end gap-2 border-t border-border pt-3">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write a message"
                  rows={2}
                  maxLength={10000}
                  aria-label="Message"
                />
                <Button type="submit" disabled={busy || !message.trim()} aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

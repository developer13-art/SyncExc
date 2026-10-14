import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supportApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useTickets(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.support.tickets(params),
    queryFn: () => supportApi.listTickets(params),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (payload) => supportApi.createTicket(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] }),
  });

  return {
    tickets: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    createTicket: create.mutateAsync,
  };
}

export function useTicket(ticketId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.support.ticket(ticketId),
    queryFn: () => supportApi.getTicket(ticketId),
    enabled: Boolean(ticketId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const messagesQuery = useQuery({
    queryKey: queryKeys.support.messages(ticketId, {}),
    queryFn: () => supportApi.listMessages(ticketId),
    enabled: Boolean(ticketId),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const attachmentsQuery = useQuery({
    queryKey: queryKeys.support.attachments(ticketId),
    queryFn: () => supportApi.listAttachments(ticketId),
    enabled: Boolean(ticketId),
    staleTime: 30_000,
  });

  const postMessage = useMutation({
    mutationFn: (payload) => supportApi.postMessage(ticketId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.support.messages(ticketId, {}),
      }),
  });

  const uploadAttachment = useMutation({
    mutationFn: (file) => supportApi.uploadAttachment(ticketId, file),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.support.attachments(ticketId),
      }),
  });

  const reopen = useMutation({
    mutationFn: (payload) => supportApi.reopenTicket(ticketId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.support.ticket(ticketId) }),
  });

  const submitFeedback = useMutation({
    mutationFn: (payload) => supportApi.submitFeedback(ticketId, payload),
  });

  return {
    ticket: detailQuery.data ?? null,
    messages: messagesQuery.data?.items ?? [],
    meta: messagesQuery.data?.meta ?? {},
    attachments: attachmentsQuery.data ?? [],
    isLoading: detailQuery.isLoading,
    postMessage: postMessage.mutateAsync,
    uploadAttachment: uploadAttachment.mutateAsync,
    reopenTicket: reopen.mutateAsync,
    submitFeedback: submitFeedback.mutateAsync,
  };
}

export function useHelpArticles(params = {}) {
  return useQuery({
    queryKey: queryKeys.support.helpArticles(params),
    queryFn: () => supportApi.listHelpArticles(params),
    staleTime: 5 * 60_000,
  });
}

export function useHelpArticle(slug) {
  return useQuery({
    queryKey: queryKeys.support.helpArticle(slug),
    queryFn: () => supportApi.getHelpArticle(slug),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}

export function useHelpSearch(params = {}) {
  return useQuery({
    queryKey: queryKeys.support.helpSearch(params),
    queryFn: () => supportApi.searchHelp(params),
    enabled: Boolean(params?.q),
    staleTime: 30_000,
  });
}
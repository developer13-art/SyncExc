import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { communityApi } from '../api/index.js';
import { queryKeys } from './queryKeys.js';

export function useCommunityProfile() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: queryKeys.community.myProfile,
    queryFn: () => communityApi.getMyProfile(),
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: (payload) => communityApi.updateMyProfile(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community'] }),
  });

  return {
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    updateProfile: update.mutateAsync,
  };
}

export function useCommunityFeed(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.community.feed(params),
    queryFn: () => communityApi.getFeed(params),
    staleTime: 30_000,
    ...options,
  });
}

export function useCommunityPosts(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.community.posts(params),
    queryFn: () => communityApi.listPosts(params),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (payload) => communityApi.createPost(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community'] }),
  });

  return {
    posts: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    refetch: listQuery.refetch,
    createPost: create.mutateAsync,
  };
}

export function useCommunityPost(postId) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: queryKeys.community.post(postId),
    queryFn: () => communityApi.getPost(postId),
    enabled: Boolean(postId),
    staleTime: 30_000,
  });

  const commentsQuery = useQuery({
    queryKey: queryKeys.community.comments(postId, {}),
    queryFn: () => communityApi.listComments(postId),
    enabled: Boolean(postId),
    staleTime: 20_000,
  });

  const addComment = useMutation({
    mutationFn: (payload) => communityApi.createComment(postId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.community.comments(postId, {}) }),
  });

  const addReaction = useMutation({
    mutationFn: (payload) => communityApi.addReaction({ postId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.community.post(postId) });
    },
  });

  return {
    post: detailQuery.data ?? null,
    comments: commentsQuery.data?.items ?? [],
    meta: commentsQuery.data?.meta ?? {},
    isLoading: detailQuery.isLoading,
    commentsIsLoading: commentsQuery.isLoading,
    commentsIsError: commentsQuery.isError,
    refetchComments: commentsQuery.refetch,
    addComment: addComment.mutateAsync,
    addReaction: addReaction.mutateAsync,
    refetch: async () => {
      await detailQuery.refetch();
      await commentsQuery.refetch();
    },
  };
}

export function useCommunityGroups(params = {}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.community.groups(params),
    queryFn: () => communityApi.listGroups(params),
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: (payload) => communityApi.createGroup(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community', 'groups'] }),
  });

  const join = useMutation({
    mutationFn: ({ groupId, ...payload }) => communityApi.joinGroup(groupId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community', 'groups'] }),
  });

  const leave = useMutation({
    mutationFn: (groupId) => communityApi.leaveGroup(groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community', 'groups'] }),
  });

  return {
    groups: listQuery.data?.items ?? [],
    meta: listQuery.data?.meta ?? {},
    isLoading: listQuery.isLoading,
    createGroup: create.mutateAsync,
    joinGroup: join.mutateAsync,
    leaveGroup: leave.mutateAsync,
  };
}

export function useCommunityRecommendations(params = {}) {
  const peopleQuery = useQuery({
    queryKey: queryKeys.community.recommendationsPeople(params),
    queryFn: () => communityApi.getRecommendationsPeople(params),
    staleTime: 5 * 60_000,
  });

  const groupsQuery = useQuery({
    queryKey: queryKeys.community.recommendationsGroups(params),
    queryFn: () => communityApi.getRecommendationsGroups(params),
    staleTime: 5 * 60_000,
  });

  const submitFeedback = useMutation({
    mutationFn: (payload) => communityApi.submitRecommendationFeedback(payload),
  });

  return {
    people: peopleQuery.data ?? [],
    groups: groupsQuery.data ?? [],
    isLoading: peopleQuery.isLoading || groupsQuery.isLoading,
    submitFeedback: submitFeedback.mutateAsync,
  };
}

export function useCommunitySearch(params = {}, { enabled = Boolean(params?.q) } = {}) {
  return useQuery({
    queryKey: queryKeys.community.search(params),
    queryFn: () => communityApi.search(params),
    enabled,
    staleTime: 30_000,
  });
}
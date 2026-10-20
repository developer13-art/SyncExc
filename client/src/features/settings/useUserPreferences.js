import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { identityApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { useToast } from '../../hooks/useToast.js';

export const userPreferencesQueryKey = ['identity', 'user-preferences'];

export function useUserPreferences() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: userPreferencesQueryKey,
    queryFn: () => identityApi.getPreferences(),
  });
  const mutation = useMutation({
    mutationFn: (updates) => identityApi.updatePreferences(updates),
    onSuccess: (preferences) => {
      queryClient.setQueryData(userPreferencesQueryKey, preferences);
      toast.success('Settings saved');
    },
    onError: (error) => {
      toast.error('Could not save settings', { description: getErrorMessage(error) });
    },
  });

  return { query, save: mutation.mutateAsync, isSaving: mutation.isPending };
}

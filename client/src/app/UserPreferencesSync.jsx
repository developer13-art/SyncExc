import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { identityApi } from '../api/index.js';
import { useAuthContext } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { userPreferencesQueryKey } from '../features/settings/useUserPreferences.js';

export function UserPreferencesSync() {
  const { user } = useAuthContext();
  const { setTheme } = useTheme();
  const preferencesQuery = useQuery({
    queryKey: userPreferencesQueryKey,
    queryFn: () => identityApi.getPreferences(),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
  const themePreference = preferencesQuery.data?.general?.theme;

  useEffect(() => {
    if (themePreference) setTheme(themePreference);
  }, [setTheme, themePreference]);

  return null;
}

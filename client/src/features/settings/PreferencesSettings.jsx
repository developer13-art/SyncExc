import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select.jsx';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { SettingsSectionNav } from './components/SettingsSectionNav.jsx';
import { useUserPreferences } from './useUserPreferences.js';

export default function PreferencesSettings() {
  const dispatch = useDispatch();
  const { setTheme } = useTheme();
  const { query, save, isSaving } = useUserPreferences();
  const [themePreference, setThemePreference] = useState('system');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Appearance and preferences'));
    dispatch(uiActions.setBreadcrumbs([
      { label: 'Settings', path: ROUTES.app.settings.overview },
      { label: 'Preferences', path: ROUTES.app.settings.preferences },
    ]));
  }, [dispatch]);

  useEffect(() => {
    if (query.data?.general?.theme) setThemePreference(query.data.general.theme);
  }, [query.data?.general?.theme]);

  if (query.isLoading) return <LoadingState label="Loading preferences" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Preferences unavailable"
        description="Your account preferences could not be loaded."
        onRetry={query.refetch}
      />
    );
  }

  const handleSave = async (event) => {
    event.preventDefault();
    await save({ general: { theme: themePreference } });
    setTheme(themePreference);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Appearance and preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal display preferences are synced to your account and do not change trading permissions.
        </p>
      </header>
      <SettingsSectionNav activePath={ROUTES.app.settings.preferences} />
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose a theme for SyncExc on this and your other signed-in devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5 sm:max-w-xl" onSubmit={handleSave}>
            <div className="flex flex-col gap-2">
              <label htmlFor="settings-theme" className="text-sm font-medium text-foreground">Theme</label>
              <Select value={themePreference} onValueChange={setThemePreference}>
                <SelectTrigger id="settings-theme"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Use system setting</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving || themePreference === query.data?.general?.theme}>
                {isSaving ? 'Saving…' : 'Save preferences'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

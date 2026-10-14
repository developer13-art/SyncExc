import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { FlaskConical, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { EnvironmentCard } from './components/EnvironmentCard.jsx';
import { useSimulationEnvironments } from '../../hooks/useSimulation.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Environments() {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Simulation Environments'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Simulation', path: ROUTES.app.simulation.overview },
        { label: 'Environments', path: ROUTES.app.simulation.environments },
      ]),
    );
  }, [dispatch]);

  const envQuery = useSimulationEnvironments({ q: query || undefined });
  const environments = envQuery.environments ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Simulation Environments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Isolated test contexts with virtual balances. Simulation never shares writable
            records with live accounts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.simulation.runs}>Runs</Link>
          </Button>
          <Button asChild>
            <Link to={ROUTES.app.simulation.createEnvironment}>
              <Plus className="h-4 w-4" /> New environment
            </Link>
          </Button>
        </div>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search environments…"
        className="w-full max-w-xs"
      />

      {envQuery.isLoading ? (
        <LoadingState label="Loading environments" />
      ) : envQuery.isError ? (
        <ErrorState
          title="Unable to load environments"
          description="We could not fetch your simulation environments."
          onRetry={envQuery.refetch}
        />
      ) : environments.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={query ? 'No matching environments' : 'No environments yet'}
          description={
            query
              ? 'Try a different search query.'
              : 'Create a simulation environment to test strategies without placing live orders.'
          }
          action={
            !query ? (
              <Button asChild>
                <Link to={ROUTES.app.simulation.createEnvironment}>
                  Create environment
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {environments.map((environment) => (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              onArchive={(env) => envQuery.archiveEnvironment?.(env.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
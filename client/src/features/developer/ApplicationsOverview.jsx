import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Code2, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SegmentedControl } from '../../components/navigation/SegmentedControl.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { ApplicationCard } from './components/ApplicationCard.jsx';
import { useDeveloperApplications } from '../../hooks/useDeveloper.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'suspended', label: 'Suspended' },
];

export default function ApplicationsOverview() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Developer Platform'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Developer', path: ROUTES.app.developer.overview },
      ]),
    );
  }, [dispatch]);

  const applicationsQuery = useDeveloperApplications({
    status: status === 'all' ? undefined : status,
    q: query || undefined,
  });

  const applications = applicationsQuery.applications ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Developer Platform
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register applications, create scoped credentials, subscribe to signed webhooks, and
            test integrations in an isolated sandbox.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.app.developer.createApplication}>
            <Plus className="h-4 w-4" /> Register application
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search applications…"
          className="w-full max-w-xs"
        />
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
      </div>

      {applicationsQuery.isLoading ? (
        <LoadingState label="Loading applications" />
      ) : applicationsQuery.isError ? (
        <ErrorState
          title="Unable to load applications"
          description="We could not fetch your applications."
          onRetry={applicationsQuery.refetch}
        />
      ) : applications.length === 0 ? (
        <EmptyState
          icon={Code2}
          title={query || status !== 'all' ? 'No matching applications' : 'No applications yet'}
          description={
            query || status !== 'all'
              ? 'Try adjusting your filters.'
              : 'Register an application to integrate with the SyncExc API.'
          }
          action={
            !query && status === 'all' ? (
              <Button asChild>
                <Link to={ROUTES.app.developer.createApplication}>
                  Register application
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {applications.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  );
}
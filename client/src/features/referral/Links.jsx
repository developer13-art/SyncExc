import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Link2, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { SearchInput } from '../../components/forms/SearchInput.jsx';
import { LinkCard } from './components/LinkCard.jsx';
import { useReferralLinks } from '../../hooks/useReferrals.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Links() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [query, setQuery] = useState('');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Referral Links'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Referral', path: ROUTES.app.referral.dashboard },
        { label: 'Links', path: ROUTES.app.referral.links },
      ]),
    );
  }, [dispatch]);

  const linksQuery = useReferralLinks({ q: query || undefined });
  const { links, isLoading, isError, refetch, pauseLink, resumeLink, revokeLink } =
    linksQuery;

  const handlePause = async (link) => {
    try {
      await pauseLink({ linkId: link.id });
      toast.success('Link paused');
    } catch (err) {
      toast.error('Pause failed', { description: getErrorMessage(err) });
    }
  };

  const handleResume = async (link) => {
    try {
      await resumeLink({ linkId: link.id });
      toast.success('Link resumed');
    } catch (err) {
      toast.error('Resume failed', { description: getErrorMessage(err) });
    }
  };

  const handleRevoke = async (link) => {
    try {
      await revokeLink({ linkId: link.id, reason: 'Revoked from UI' });
      toast.success('Link revoked');
    } catch (err) {
      toast.error('Revoke failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Referral Links
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage unique referral links for different campaigns, channels, or
            audiences.
          </p>
        </div>
        <Button asChild>
          <Link to={ROUTES.app.referral.createLink}>
            <Plus className="h-4 w-4" /> New link
          </Link>
        </Button>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search links…"
        className="w-full max-w-xs"
      />

      {isLoading ? (
        <LoadingState label="Loading links" />
      ) : isError ? (
        <ErrorState
          title="Unable to load links"
          description="We could not fetch your referral links."
          onRetry={refetch}
        />
      ) : links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title={query ? 'No matching links' : 'No referral links yet'}
          description={
            query
              ? 'Try a different search query.'
              : 'Create your first referral link to start earning commissions.'
          }
          action={
            !query ? (
              <Button asChild>
                <Link to={ROUTES.app.referral.createLink}>Create link</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onPause={handlePause}
              onResume={handleResume}
              onRevoke={handleRevoke}
            />
          ))}
        </div>
      )}
    </div>
  );
}
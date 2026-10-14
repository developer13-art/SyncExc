import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { BookOpen, MessageSquare, Plus } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { TicketList } from './components/TicketList.jsx';
import { HelpSearch } from './components/HelpSearch.jsx';
import { useTickets } from '../../hooks/useSupport.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function SupportCenter() {
  const dispatch = useDispatch();
  const ticketsQuery = useTickets({ limit: 10 });

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Support'));
    dispatch(
      uiActions.setBreadcrumbs([{ label: 'Support', path: ROUTES.app.support.overview }]),
    );
  }, [dispatch]);

  const tickets = ticketsQuery.tickets ?? [];
  const openTickets = tickets.filter(
    (t) => !['resolved', 'closed', 'cancelled'].includes(t.status),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find help articles, create tickets, and track responses. Support access is scoped to
            your account and never grants trading authority.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={ROUTES.app.support.help}>
              <BookOpen className="h-4 w-4" /> Help center
            </Link>
          </Button>
          <Button asChild>
            <Link to={ROUTES.app.support.createTicket}>
              <Plus className="h-4 w-4" /> New ticket
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Open tickets" value={openTickets.length} icon={MessageSquare} />
        <StatCard
          label="Awaiting your reply"
          value={tickets.filter((t) => t.awaitingResponseFromUser).length}
          tone="warning"
        />
        <StatCard
          label="Recently resolved"
          value={tickets.filter((t) => t.status === 'resolved').length}
          tone="success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search help articles</CardTitle>
        </CardHeader>
        <CardContent>
          <HelpSearch />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your tickets</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={ROUTES.app.support.tickets}>View all</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {ticketsQuery.isLoading ? (
            <div className="p-5">
              <LoadingState label="Loading tickets" />
            </div>
          ) : ticketsQuery.isError ? (
            <div className="p-5">
              <ErrorState
                title="Unable to load tickets"
                description="We could not fetch your tickets."
                onRetry={ticketsQuery.refetch}
              />
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={MessageSquare}
                title="No tickets yet"
                description="Open a ticket if you need help with your account, connections, or operations."
                size="sm"
                className="border-0 bg-transparent"
                action={
                  <Button asChild>
                    <Link to={ROUTES.app.support.createTicket}>Create ticket</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <TicketList tickets={tickets} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
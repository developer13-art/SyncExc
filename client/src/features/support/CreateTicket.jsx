import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { TicketForm } from './components/TicketForm.jsx';
import { HelpSearch } from './components/HelpSearch.jsx';
import { useTickets } from '../../hooks/useSupport.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CreateTicket() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createTicket } = useTickets();

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Create Support Ticket'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Support', path: ROUTES.app.support.overview },
        { label: 'New ticket', path: ROUTES.app.support.createTicket },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (values) => {
    setError(null);
    setSubmitting(true);
    try {
      const ticket = await createTicket({
        subject: values.subject.trim(),
        category: values.category,
        description: values.description.trim(),
        impact: values.impact,
        affectedResource: values.affectedResource?.trim() || undefined,
      });
      toast.success('Ticket submitted', {
        description: 'You will receive a confirmation and updates by email.',
      });
      navigate(ROUTES.app.support.ticket(ticket.id), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.support.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Create a support ticket
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Provide enough detail so we can investigate without needing credentials. Support
              staff will never ask for passwords or API secrets.
            </p>
          </div>

          <Card>
            <CardContent className="p-6 pt-6">
              <TicketForm
                onSubmit={handleSubmit}
                onCancel={() => navigate(ROUTES.app.support.overview)}
                isSubmitting={submitting}
                formError={error}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-5 pt-5">
              <p className="mb-3 text-sm font-semibold text-foreground">
                Before creating a ticket
              </p>
              <HelpSearch />
            </CardContent>
          </Card>

          <Card className="border-info/30 bg-info/5">
            <CardContent className="p-4 pt-4 text-xs text-muted-foreground">
              A ticket does not authorize support staff to execute trades, alter risk rules, or
              access exchange credentials. Those actions require separate authorization.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
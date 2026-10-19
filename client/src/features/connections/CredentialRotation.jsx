import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CredentialForm } from './components/CredentialForm.jsx';
import { PermissionChecklist } from './components/PermissionChecklist.jsx';
import { connectionsApi } from '../../api/index.js';
import { useConnection } from '../../hooks/useConnections.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CredentialRotation() {
  const { connectionId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const connectionQuery = useConnection(connectionId);
  const { connection, isLoading } = connectionQuery;

  const [step, setStep] = useState('enter');
  const [requirements, setRequirements] = useState([]);
  const [credentials, setCredentials] = useState({});
  const [credentialErrors, setCredentialErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Rotate Credentials'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Connections', path: ROUTES.app.connections.overview },
        {
          label: connection?.label ?? connection?.exchangeName ?? 'Connection',
          path: ROUTES.app.connections.details(connectionId),
        },
        { label: 'Rotate credentials', path: ROUTES.app.connections.rotate(connectionId) },
      ]),
    );
  }, [dispatch, connection, connectionId]);

  useEffect(() => {
    if (!connection?.exchangeId) {
      return;
    }
    let cancelled = false;
    connectionsApi
      .getConnectionRequirements(connection.exchangeId)
      .then((result) => {
        if (!cancelled) {
          setRequirements(result.requirements ?? result ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRequirements([
            { name: 'apiKey', label: 'API Key', type: 'text', required: true },
            { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
          ]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [connection?.exchangeId]);

  const handleChange = (name, value) => {
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setCredentialErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setFormError(null);
  };

  const handleSubmit = async () => {
    setFormError(null);
    setCredentialErrors({});

    const missing = requirements
      .filter((r) => r.required !== false && !credentials[r.name])
      .reduce((acc, r) => {
        acc[r.name] = `${r.label ?? r.name} is required`;
        return acc;
      }, {});

    if (Object.keys(missing).length > 0) {
      setCredentialErrors(missing);
      return;
    }

    setSubmitting(true);
    try {
      const result = await connectionsApi.rotateCredentials(connectionId, { credentials });
      setPermissions(result.permissions ?? {});
      setStep('verify');
      toast.success('Credentials rotated', {
        description: 'Review the updated permissions before confirming.',
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = () => {
    toast.success('Rotation confirmed');
    navigate(ROUTES.app.connections.details(connectionId), { replace: true });
  };

  if (isLoading) {
    return <LoadingState label="Loading connection" />;
  }

  if (!connection) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Connection not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.connections.details(connectionId)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Rotate credentials
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Replace the API credentials for {connection.label ?? connection.exchangeName}. The
            new credentials are validated before the old ones are invalidated.
          </p>
        </div>

        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex gap-2 p-4 pt-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs text-muted-foreground">
              During rotation, the old credentials remain valid until the new ones pass
              validation. This ensures active operations are not interrupted.
            </p>
          </CardContent>
        </Card>

        {step === 'enter' ? (
          <div className="mt-6">
            <CredentialForm
              exchangeRequirements={requirements}
              values={credentials}
              errors={credentialErrors}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={() => navigate(ROUTES.app.connections.details(connectionId))}
              isSubmitting={submitting}
              formError={formError}
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <p className="text-sm font-medium text-foreground">
                New credentials validated
              </p>
            </div>

            <Card>
              <CardContent className="p-5 pt-5">
                <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Verified permissions with new credentials
                </p>
                <PermissionChecklist permissions={permissions ?? {}} />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('enter')}
                disabled={submitting}
              >
                Replace credentials
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                Confirm rotation
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
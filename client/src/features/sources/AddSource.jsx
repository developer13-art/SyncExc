import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { Label } from '../../components/ui/Label.jsx';
import { RegisterSourceForm } from './components/RegisterSourceForm.jsx';
import { TelegramSourceWizard } from './components/TelegramSourceWizard.jsx';
import { sourcesApi } from '../../api/index.js';
import { useSources } from '../../hooks/useSources.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function AddSource() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createSource } = useSources();

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sourceType, setSourceType] = useState('telegram');

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Add Signal Source'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Sources', path: ROUTES.app.sources.overview },
        { label: 'Add', path: ROUTES.app.sources.create },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (values) => {
    setError(null);
    setSubmitting(true);
    try {
      const created = await createSource({
        name: values.name.trim(),
        type: values.type,
        identifier: values.identifier.trim(),
        url: values.url?.trim() || undefined,
        language: values.language?.trim() || undefined,
        categories: values.categories
          ? values.categories
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        notes: values.notes?.trim() || undefined,
      });

      toast.success('Source registered', {
        description: 'The source will be reviewed before ingestion begins.',
      });
      navigate(ROUTES.app.sources.details(created.id), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTelegramComplete = async (createdSources) => {
    if (!createdSources?.length) {
      setError('No Telegram sources were created.');
      return;
    }
    toast.success(
      createdSources.length === 1 ? 'Telegram source connected' : 'Telegram sources connected',
      { description: 'Monitoring is on for the chats you selected. Trading remains governed by each source’s execution settings.' },
    );
    navigate(ROUTES.app.sources.details(createdSources[0].id), { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.sources.overview}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Add a signal source
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Telegram with your account, or register another source manually.
          </p>
        </div>

        <div className="mb-5 flex flex-col gap-1.5">
          <Label htmlFor="source-platform">Source platform</Label>
          <Select
            value={sourceType}
            onValueChange={(value) => {
              setSourceType(value);
              setError(null);
            }}
          >
            <SelectTrigger id="source-platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="discord">Discord</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="rest_api">External API</SelectItem>
              <SelectItem value="website">Website or public feed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sourceType === 'telegram' ? (
          <TelegramSourceWizard
            onComplete={handleTelegramComplete}
            onCancel={() => navigate(ROUTES.app.sources.overview)}
          />
        ) : (
          <RegisterSourceForm
            key={sourceType}
            initialType={sourceType}
            showTypeField={false}
            onSubmit={handleSubmit}
            onCancel={() => navigate(ROUTES.app.sources.overview)}
            isSubmitting={submitting}
            formError={error}
          />
        )}
      </div>
    </div>
  );
}

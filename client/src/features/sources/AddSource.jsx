import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { RegisterSourceForm } from './components/RegisterSourceForm.jsx';
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
          ? values.categories.split(',').map((s) => s.trim()).filter(Boolean)
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
            Register a source manually if you already know its identifier. Approval and
            validation are separate steps after registration.
          </p>
        </div>

        <RegisterSourceForm
          onSubmit={handleSubmit}
          onCancel={() => navigate(ROUTES.app.sources.overview)}
          isSubmitting={submitting}
          formError={error}
        />
      </div>
    </div>
  );
}
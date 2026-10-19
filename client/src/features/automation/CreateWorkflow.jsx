import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { useWorkflows } from '../../hooks/useAutomation.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CreateWorkflow() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createWorkflow } = useWorkflows();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('New Workflow'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Automation', path: ROUTES.app.automation.overview },
        { label: 'New workflow', path: ROUTES.app.automation.create },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const workflowName = name.trim();
    if (!workflowName) {
      setError('Workflow name is required');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const workflow = await createWorkflow({
        name: workflowName,
        description: description.trim() || undefined,
      });
      toast.success('Workflow created');
      navigate(ROUTES.app.automation.edit(workflow.id), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link to={ROUTES.app.automation.overview}>
          <ArrowLeft className="h-4 w-4" /> Back to automation
        </Link>
      </Button>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create a workflow
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Give the workflow a name, then add triggers and actions in the builder.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormError>{error}</FormError>
              <FormField label="Name" htmlFor="workflow-name" required>
                <Input
                  id="workflow-name"
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="My workflow"
                />
              </FormField>
              <FormField label="Description" htmlFor="workflow-description">
                <Textarea
                  id="workflow-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What should this workflow do?"
                  rows={4}
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" asChild>
                  <Link to={ROUTES.app.automation.overview}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create workflow'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

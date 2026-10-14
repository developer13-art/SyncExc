import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Copy, LayoutTemplate } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { useWorkflowTemplates } from '../../hooks/useAutomation.js';
import { automationApi } from '../../api/index.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function Templates() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Workflow Templates'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Automation', path: ROUTES.app.automation.overview },
        { label: 'Templates', path: ROUTES.app.automation.templates },
      ]),
    );
  }, [dispatch]);

  const templatesQuery = useWorkflowTemplates({});
  const templates = templatesQuery.templates ?? [];

  const handleClone = async (template) => {
    try {
      const cloned = await automationApi.cloneTemplate(template.id, {
        name: `${template.name} (copy)`,
      });
      toast.success('Workflow created from template', {
        description: 'Edit and publish when ready.',
      });
      navigate(ROUTES.app.automation.edit(cloned.id), { replace: true });
    } catch (err) {
      toast.error('Clone failed', { description: getErrorMessage(err) });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Workflow Templates
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start from a validated workflow pattern. Cloning creates an independent draft — the
          template is not affected by your changes.
        </p>
      </div>

      {templatesQuery.isLoading ? (
        <LoadingState label="Loading templates" />
      ) : templatesQuery.isError ? (
        <ErrorState
          title="Unable to load templates"
          description="We could not fetch workflow templates."
          onRetry={templatesQuery.refetch}
        />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No templates available"
          description="Templates will appear here as they are published."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {template.name}
                    </p>
                    {template.author ? (
                      <p className="mt-0.5 text-2xs text-muted-foreground">
                        by {template.author}
                      </p>
                    ) : null}
                  </div>
                  {template.version !== undefined ? (
                    <Badge variant="muted">v{template.version}</Badge>
                  ) : null}
                </div>

                {template.description ? (
                  <p className="line-clamp-3 text-xs text-muted-foreground">
                    {template.description}
                  </p>
                ) : null}

                {template.useCase ? (
                  <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                    {template.useCase}
                  </p>
                ) : null}

                {template.requiredIntegrations?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {template.requiredIntegrations.slice(0, 3).map((integration) => (
                      <span
                        key={integration}
                        className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-2xs text-muted-foreground"
                      >
                        {integration}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto pt-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleClone(template)}
                  >
                    <Copy className="h-3.5 w-3.5" /> Use template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
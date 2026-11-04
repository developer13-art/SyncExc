import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ConsoleActionDialog } from './ConsoleActionDialog.jsx';
import { humanize } from './console.utils.js';

export function ConsoleCreate({ page, section }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const resource = page.resource;
  const action = resource?.actions.find((entry) => entry.scope === 'resource');

  if (!resource || !action) {
    return (
      <EmptyState
        icon={PlusCircle}
        title="No creation workflow for this page"
        description="This page is not linked to an allow-listed creation action."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {section.label}
                </p>
                <Badge variant="muted" size="sm">{resource.label}</Badge>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {humanize(page.pageId)}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {action.description
                  || 'Creation requires a written reason and is recorded in the administrative audit log.'}
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!page.permissions?.manage}>
            <PlusCircle className="h-4 w-4" />
            {action.label}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{action.label}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!page.permissions?.manage ? (
            <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              Your administrator role does not have manage permission for {section.label.toLowerCase()}.
              You can review this workflow but not submit it.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            The form collects the following required information:
          </p>
          <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            {(action.fields || []).map((field) => (
              <li key={field.key} className="flex items-center gap-2 rounded-md border border-border p-2">
                <Badge variant={field.required ? 'warning' : 'muted'} size="sm">
                  {field.required ? 'Required' : 'Optional'}
                </Badge>
                <span className="text-foreground">{field.label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <ConsoleActionDialog
        open={open}
        onOpenChange={setOpen}
        action={action}
        resourceKey={resource.key}
        recordId={null}
        onCompleted={() => {
          const base = `/catalog/${page.sectionId}/${page.pageId}`;
          navigate(base);
        }}
      />
    </div>
  );
}

export default ConsoleCreate;

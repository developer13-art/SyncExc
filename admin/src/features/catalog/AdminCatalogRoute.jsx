import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CircleHelp } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { getAdminCatalogPage } from '../../config/admin-navigation.js';

export default function AdminCatalogRoute() {
  const { sectionId, pageId } = useParams();
  const destination = getAdminCatalogPage(sectionId, pageId);

  if (!destination) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          This admin navigation route does not match a registered page.
        </CardContent>
      </Card>
    );
  }

  const { section, page } = destination;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/overview" className="text-sm text-primary hover:underline">
          ← Admin overview
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{page.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{section.label}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-muted-foreground" />
            Route added to admin navigation
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <p className="text-muted-foreground">
            This page is registered and directly reachable from the navigation. Its end-to-end
            workflow has not been implemented yet, so this route does not display placeholder
            records or pretend that the feature is operational.
          </p>
          <p className="text-muted-foreground">
            Existing operational admin pages remain available from their own navigation entries.
          </p>
          <Button asChild variant="outline" className="justify-self-start">
            <Link to="/overview">
              <ArrowLeft className="h-4 w-4" />
              Return to overview
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

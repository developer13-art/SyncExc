import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ProviderDisclosureList } from '../../components/domain/provider/ProviderDisclosureList.jsx';
import { useMarketplaceProvider } from '../../hooks/useMarketplace.js';

export function ProviderDisclosures({ providerId }) {
  const providerQuery = useMarketplaceProvider(providerId);

  if (providerQuery.isLoading) {
    return <LoadingState label="Loading disclosures" />;
  }

  const disclosures = providerQuery.disclosures ?? [];

  if (disclosures.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No disclosures are available for this provider yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <ProviderDisclosureList disclosures={disclosures} />
      </CardContent>
    </Card>
  );
}
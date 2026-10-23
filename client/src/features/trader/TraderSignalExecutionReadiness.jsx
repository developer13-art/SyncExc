import { useConnections } from '../../hooks/useConnections.js';
import { useWorkspaceContext } from '../../context/WorkspaceContext.jsx';
import { useUserPreferences } from '../settings/useUserPreferences.js';
import { getErrorMessage } from '../../api/errors.js';

export function useTraderSignalExecutionReadiness({ marketType, direction, orderType }) {
  const { activeWorkspaceId } = useWorkspaceContext();
  const connectionsQuery = useConnections(
    { status: 'active' },
    Boolean(activeWorkspaceId),
  );
  const preferences = useUserPreferences();
  const preferenceQuery = preferences.query;
  const percentage = preferenceQuery.data?.trading?.signalExecutionPercentage;
  const activeAccounts = connectionsQuery.connections.flatMap((connection) => {
    if (connection.status !== 'active' || connection.isShared) return [];
    return (connection.accounts || [])
      .filter((account) => account.status === 'active')
      .map((account) => ({
        connection,
        account,
      }));
  });
  const normalizedMarket = marketType === 'perpetual' ? 'futures' : marketType;
  const compatibleAccounts = activeAccounts.filter(({ connection }) => {
    const capabilities = connection.capabilities || {};
    const marketSupported = normalizedMarket === 'spot'
      ? capabilities.hasSpot
      : capabilities.hasFutures;
    if (!marketSupported || (normalizedMarket === 'spot' && direction === 'short')) {
      return false;
    }

    const protectedMarkets = capabilities.hasAttachedBracketProtectionMarkets || [];
    const protectedOrderTypes =
      capabilities.hasAttachedBracketProtectionOrderTypes?.[normalizedMarket];
    const supportsAttachedProtection = protectedMarkets.includes(normalizedMarket) &&
      (Array.isArray(protectedOrderTypes)
        ? protectedOrderTypes.includes(orderType)
        : ['market', 'limit'].includes(orderType));
    const protectedMarketFallback = capabilities.protectedMarketOrderFallbacks?.[normalizedMarket];
    const supportsProtectedFallback = orderType === 'market' &&
      protectedMarketFallback?.orderType === 'limit' &&
      protectedMarketFallback?.timeInForce === 'IOC' &&
      protectedMarketFallback.directions?.includes(direction);
    return supportsAttachedProtection || supportsProtectedFallback;
  });

  const isLoading = connectionsQuery.isLoading || preferenceQuery.isLoading;
  const error = connectionsQuery.error || preferenceQuery.error;
  const executionConfigured = Number.isFinite(Number(percentage)) &&
    Number(percentage) > 0 &&
    Number(percentage) <= 100;
  const canPublish = !isLoading &&
    !error &&
    executionConfigured &&
    compatibleAccounts.length > 0;
  const unsupportedAccounts = activeAccounts.filter(
    ({ connection }) => !compatibleAccounts.some(
      ({ account }) => account.connection_id === connection.id,
    ),
  );
  const fallback = compatibleAccounts
    .map(({ connection }) =>
      connection.capabilities?.protectedMarketOrderFallbacks?.[normalizedMarket])
    .find((candidate) =>
      candidate?.orderType === 'limit' &&
      candidate?.timeInForce === 'IOC' &&
      candidate.directions?.includes(direction),
    );

  return {
    canPublish,
    isLoading,
    error,
    percentage,
    activeAccounts,
    compatibleAccounts,
    unsupportedAccounts,
    fallbackSlippagePercent: fallback ? Number(fallback.maxSlippageBps) / 100 : null,
    savePreferences: preferences.save,
    isSavingPreferences: preferences.isSaving,
  };
}

export function TraderSignalExecutionReadiness({
  readiness,
  marketType,
  direction,
  orderType,
}) {
  let message;
  if (readiness.isLoading) {
    message = 'Checking your execution size, exchange accounts, and protection support…';
  } else if (readiness.error) {
    message = `Execution readiness could not be verified: ${getErrorMessage(readiness.error)}. Fix this before publishing.`;
  } else if (!readiness.percentage) {
    message = 'Automatic trader-account execution is disabled. Set a balance allocation below before publishing a signal.';
  } else if (readiness.activeAccounts.length === 0) {
    message = 'No active exchange accounts are available in this workspace. Connect and activate an exchange account before publishing.';
  } else if (readiness.compatibleAccounts.length === 0) {
    message = marketType === 'spot' && direction === 'short'
      ? 'Spot accounts cannot open short positions. Choose Futures/Perpetual or a supported Spot long setup.'
      : `None of your active exchange accounts can attach stop-loss and take-profit for this ${marketType} ${orderType} setup. Choose a supported market and order type before publishing.`;
  } else if (marketType === 'spot' && orderType === 'market') {
    message = `Publishing will attempt a protected Spot entry using a marketable IOC limit capped at ${readiness.fallbackSlippagePercent}% slippage, with ${readiness.percentage}% of available balance per eligible account. It may partially fill or not fill; risk and permission checks still apply.`;
  } else {
    message = `Publishing will attempt this protected ${marketType} ${orderType} trade on ${readiness.compatibleAccounts.length} eligible account(s), using ${readiness.percentage}% of available balance per account. Risk and permission checks can still block it or require approval.`;
  }

  return (
    <p
      className={`rounded-md border p-3 text-sm ${
        readiness.canPublish
          ? 'border-info/30 bg-info/5 text-foreground'
          : 'border-destructive/30 bg-destructive/5 text-destructive'
      }`}
      role={readiness.canPublish ? 'status' : 'alert'}
    >
      {message}
      {readiness.canPublish && readiness.unsupportedAccounts.length > 0
        ? ` ${readiness.unsupportedAccounts.length} other active account(s) will be skipped because they cannot safely execute this setup.`
        : ''}
    </p>
  );
}

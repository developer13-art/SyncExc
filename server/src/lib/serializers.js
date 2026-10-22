/**
 * SyncExc Server — Serializers
 *
 * Convert database rows into client-safe payloads. Never include password
 * hashes, tokens, secrets, or internal-only columns.
 *
 * Every resource that flows through the API has exactly one serializer.
 */

export function serializeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || null,
    preferredLanguage: row.preferred_language,
    timezone: row.timezone,
    countryCode: row.country_code || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeUserMe(row, { mfaEnabled } = {}) {
  const base = serializeUser(row);
  if (!base) return null;
  return {
    ...base,
    mfaEnabled: Boolean(mfaEnabled),
  };
}

export function serializeSession(row, currentSessionId) {
  if (!row) return null;
  return {
    id: row.id,
    deviceLabel: row.device_label || null,
    userAgent: row.user_agent || null,
    ipAddress: row.ip_address || null,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at,
    isCurrent: currentSessionId ? row.id === currentSessionId : false,
  };
}

export function serializeTrustedDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    deviceLabel: row.device_label || null,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  };
}

export function serializeSecurityEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.event_type,
    outcome: row.outcome,
    ipAddress: row.ip_address || null,
    deviceMetadata: row.device_metadata || null,
    occurredAt: row.occurred_at,
    metadata: row.metadata || null,
  };
}

export function serializeWorkspace(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    slug: row.slug || null,
    visibility: row.visibility || 'private',
    ownerId: row.owner_id,
    description: row.description || null,
    timezone: row.timezone,
    preferredLanguage: row.preferred_language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeWorkspaceMembership(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    extraPermissions: row.extra_permissions || [],
    joinedAt: row.created_at,
  };
}

export function serializeInvitation(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at || null,
  };
}

export function serializeConnectionShareGrant(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connection_id,
    homeWorkspaceId: row.home_workspace_id,
    recipientWorkspaceId: row.recipient_workspace_id,
    allowedOperations: row.allowed_operations || [],
    status: row.status,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
    revokedAt: row.revoked_at || null,
  };
}

export function serializePlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializePlanVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.plan_id,
    version: row.version_number,
    features: row.features || {},
    limits: row.limits || {},
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until || null,
    publishedAt: row.published_at,
  };
}

export function serializePlanPrice(row) {
  if (!row) return null;
  return {
    id: row.id,
    planVersionId: row.plan_version_id,
    currency: row.currency,
    amountMinor: row.amount_minor,
    billingInterval: row.billing_interval,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until || null,
  };
}

export function serializeSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    scopeType: row.billing_scope_type,
    scopeId: row.billing_scope_id,
    planVersionId: row.plan_version_id,
    planPriceId: row.plan_price_id,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    nextBillingAt: row.next_billing_at || null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    canceledAt: row.canceled_at || null,
    endedAt: row.ended_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeInvoice(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    subscriptionId: row.subscription_id,
    status: row.status,
    amountMinor: row.amount_minor,
    currency: row.currency,
    issuedAt: row.issued_at,
    paidAt: row.paid_at || null,
    dueAt: row.due_at || null,
    lineItems: row.line_items || [],
  };
}

export function serializePayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    subscriptionId: row.subscription_id || null,
    checkoutSessionId: row.checkout_session_id || null,
    provider: row.provider,
    status: row.status,
    amountMinor: row.amount_minor,
    currency: row.currency,
    paidAt: row.paid_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeRefund(row) {
  if (!row) return null;
  return {
    id: row.id,
    paymentId: row.payment_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    status: row.status,
    reason: row.reason,
    requestedAt: row.created_at,
    decidedAt: row.decided_at || null,
    completedAt: row.completed_at || null,
  };
}

export function serializeConnection(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerId: row.owner_id,
    exchange: row.exchange_code || row.exchange,
    exchangeName: row.exchange_name || row.display_name || row.exchange_code || row.exchange,
    environment: row.environment,
    label: row.label,
    status: row.status,
    capabilities: row.capabilities || {},
    accountCount: row.account_count ?? row.accounts?.length ?? undefined,
    accounts: row.accounts?.map(serializeAccount),
    health: row.health || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connection_id,
    accountType: row.account_type,
    exchangeAccountId: row.exchange_account_id || null,
    status: row.status,
    supportedCapabilities: row.supported_capabilities || [],
    lastSyncAt: row.last_sync_at || null,
  };
}

export function serializeInstrument(row) {
  if (!row) return null;
  return {
    id: row.id,
    exchange: row.exchange_code || row.exchange,
    exchangeSymbol: row.exchange_symbol,
    symbol: row.exchange_symbol,
    normalizedSymbol: row.normalized_symbol,
    marketType: row.market_type,
    baseAsset: row.base_asset,
    quoteAsset: row.quote_asset,
    settlementAsset: row.settlement_asset || null,
    tickSize: row.tick_size,
    quantityStep: row.quantity_step,
    minimumQuantity: row.minimum_quantity || null,
    minimumNotional: row.minimum_notional || null,
    contractMultiplier: row.contract_multiplier || null,
    tradingStatus: row.trading_status,
    updatedAt: row.updated_at,
  };
}

export function serializeOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connection_id,
    accountId: row.account_id,
    exchangeOrderId: row.exchange_order_id || null,
    clientOrderId: row.client_order_id || null,
    instrument: row.instrument,
    marketType: row.market_type,
    side: row.side,
    type: row.type,
    quantity: row.quantity,
    filledQuantity: row.filled_quantity || null,
    remainingQuantity: row.remaining_quantity || null,
    price: row.price || null,
    averageFillPrice: row.average_fill_price || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeFill(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    exchangeTradeId: row.exchange_trade_id || null,
    instrument: row.instrument,
    side: row.side,
    quantity: row.quantity,
    price: row.price,
    feeAmount: row.fee_amount || null,
    feeAsset: row.fee_asset || null,
    executedAt: row.executed_at,
  };
}

export function serializePosition(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connection_id,
    accountId: row.account_id,
    instrument: row.instrument,
    side: row.side,
    quantity: row.quantity,
    entryPrice: row.entry_price,
    markPrice: row.mark_price || null,
    unrealizedPnl: row.unrealized_pnl || null,
    realizedPnl: row.realized_pnl || null,
    marginMode: row.margin_mode || null,
    leverage: row.leverage || null,
    liquidationPrice: row.liquidation_price || null,
    updatedAt: row.updated_at,
  };
}

export function serializeSyncGroup(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    sourceConnectionId: row.source_connection_id,
    sourceAccountId: row.source_account_id,
    marketTypes: row.market_types || [],
    enabledEventTypes: row.enabled_event_types || [],
    mirroringMode: row.mirroring_mode,
    executionMode: row.execution_mode,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeSyncOperation(row, destinations = []) {
  if (!row) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    sourceEventType: row.source_event_type,
    sourceEventPayload: row.source_event_payload,
    status: row.status,
    destinations,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}

export function serializeRiskPolicy(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    scopeRef: row.scope_ref || null,
    enforcementMode: row.enforcement_mode,
    rules: row.rules || [],
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeRiskEvaluation(row) {
  if (!row) return null;
  return {
    id: row.id,
    outcome: row.outcome,
    reasonCode: row.reason_code,
    policyVersion: row.policy_version || null,
    checkResults: row.check_results || [],
    evaluatedAt: row.evaluated_at,
  };
}

export function serializeIncident(row) {
  if (!row) return null;
  return {
    id: row.id,
    category: row.category,
    severity: row.severity,
    status: row.status,
    scope: row.scope || null,
    scopeRef: row.scope_ref || null,
    summary: row.summary,
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at || null,
  };
}

export function serializeSource(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    name: row.name,
    status: row.status,
    url: row.url || null,
    providerName: row.provider_name || null,
    healthState: row.health_state || null,
    qualityState: row.quality_state || null,
    lastEventAt: row.last_event_at || null,
    messageCount: Number(row.message_count ?? 0),
    lastMonitorError: row.last_monitor_error || null,
    monitoringEnabled: Boolean(row.monitoring_enabled),
    monitoringStartedAt: row.monitoring_started_at || null,
    executionConfigVersion: row.execution_config_version || 1,
    executionSettings: row.execution_settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeSourceCandidate(row) {
  if (!row) return null;
  return {
    id: row.id,
    discoveryJobId: row.discovery_job_id,
    name: row.name,
    url: row.url || null,
    status: row.status,
    confidenceScore: row.confidence_score,
    evidence: row.evidence || {},
    discoveredAt: row.discovered_at,
  };
}

export function serializeSignalCandidate(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceId: row.source_id,
    messageId: row.message_id,
    instrument: row.instrument,
    marketType: row.market_type || null,
    direction: row.direction,
    entry: row.entry || null,
    entryRange: row.entry_range || null,
    stopLoss: row.stop_loss || null,
    targets: row.targets || [],
    leverage: row.leverage || null,
    status: row.status,
    issues: row.issues || [],
    eligibilityOutcome: row.eligibility_outcome || null,
    executionStatus: row.execution_status || null,
    createdAt: row.created_at,
  };
}

export function serializeSignalMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceId: row.source_id,
    providerMessageId: row.provider_message_id || null,
    channelRef: row.channel_ref || null,
    providerTimestamp: row.provider_timestamp,
    receivedAt: row.received_at,
    contentType: row.content_type,
    content: row.content,
    processingStatus: row.processing_status,
  };
}

export function serializeExecutionIntent(row) {
  if (!row) return null;
  return {
    id: row.id,
    signalId: row.signal_id,
    workspaceId: row.workspace_id,
    syncGroupId: row.sync_group_id || null,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

export function serializeProvider(row) {
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    accountType: row.account_type,
    moderationState: row.moderation_state,
    visibility: row.visibility || 'private',
    biography: row.biography || null,
    methodology: row.methodology || null,
    avatarUrl: row.avatar_url || null,
    coverImageUrl: row.cover_image_url || null,
    supportedMarkets: row.supported_markets || [],
    supportedLanguages: row.supported_languages || [],
    currentVersion: row.current_version,
    createdAt: row.created_at,
  };
}

export function serializePublishedSignal(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerId: row.provider_id,
    instrument: row.instrument,
    marketType: row.market_type,
    direction: row.direction,
    entry: row.entry,
    entryRange: row.entry_range || null,
    stopLoss: row.stop_loss,
    targets: row.targets || [],
    leverage: row.leverage,
    status: row.status,
    currentVersion: row.current_version,
    validUntil: row.valid_until,
    disclosures: row.disclosures || row.metadata?.disclosures || null,
    sourceEvidence: row.metadata?.sourceEvidence || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeProviderPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    pricing: row.pricing || {},
    entitlements: row.entitlements || {},
    status: row.status,
    version: row.version,
  };
}

export function serializeProviderSubscriber(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    status: row.status,
    planName: row.plan_name || 'No plan',
    createdAt: row.created_at,
  };
}

export function serializeCopyConfiguration(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerId: row.provider_id,
    workspaceId: row.workspace_id,
    sizingRule: row.sizing_rule || {},
    executionMode: row.execution_mode,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function serializeWorkflow(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    status: row.status,
    currentVersion: row.current_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeWorkflowRun(row, steps = []) {
  if (!row) return null;
  return {
    id: row.id,
    workflowId: row.workflow_id,
    version: row.version,
    state: row.state,
    steps,
    triggerEventId: row.trigger_event_id || null,
    startedAt: row.started_at,
    completedAt: row.completed_at || null,
  };
}

export function serializeSimulationEnvironment(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    type: row.type,
    state: row.state,
    initialBalances: row.initial_balances || [],
    createdAt: row.created_at,
  };
}

export function serializeSimulationRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    environmentId: row.environment_id,
    state: row.state,
    config: row.config || {},
    metrics: row.metrics || null,
    startedAt: row.started_at,
    completedAt: row.completed_at || null,
  };
}

export function serializeAffiliate(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    payoutCurrency: row.payout_currency,
    enrolledAt: row.created_at,
  };
}

export function serializeCommissionAccrual(row) {
  if (!row) return null;
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    attributionId: row.attribution_id,
    paymentId: row.payment_id,
    type: row.type,
    state: row.state,
    amountMinor: row.amount_minor,
    currency: row.currency,
    accruedAt: row.accrued_at,
  };
}

export function serializePayout(row) {
  if (!row) return null;
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    status: row.status,
    providerTransactionId: row.provider_transaction_id || null,
    requestedAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}

export function serializeDeveloperApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerId: row.owner_id,
    name: row.name,
    type: row.type,
    state: row.state,
    createdAt: row.created_at,
  };
}

export function serializeApiCredential(row) {
  if (!row) return null;
  return {
    id: row.id,
    applicationId: row.application_id,
    environment: row.environment,
    scopes: row.scopes || [],
    state: row.state,
    createdAt: row.created_at,
    expiresAt: row.expires_at || null,
  };
}

export function serializeWebhookSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    applicationId: row.application_id,
    destinationUrl: row.destination_url,
    eventTypes: row.event_types || [],
    state: row.state,
    createdAt: row.created_at,
  };
}

export function serializeCommunityProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.biography || null,
    biography: row.biography || null,
    avatarUrl: row.avatar_url || null,
    interests: row.interests || [],
    skills: row.skills || [],
    website: row.website || null,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}

export function serializePost(row) {
  if (!row) return null;
  return {
    id: row.id,
    authorId: row.author_id,
    author: row.author_name
      ? {
          id: row.author_id,
          handle: row.author_handle,
          displayName: row.author_name,
          avatarUrl: row.author_avatar || null,
        }
      : null,
    destinationType: row.destination_type,
    destinationRefId: row.destination_ref_id || null,
    content: row.content,
    topics: row.topics || [],
    engagement: row.engagement || { reactions: 0, comments: 0, shares: 0 },
    reactionsCount: row.reaction_count ?? row.engagement?.reactions ?? 0,
    commentsCount: row.engagement?.comments || 0,
    viewerReacted: Boolean(row.viewer_reaction),
    viewerBookmarked: Boolean(row.bookmark_id),
    bookmarkId: row.bookmark_id || null,
    visibility: row.visibility,
    poll: row.poll || null,
    event: row.event || null,
    marketIdea: row.market_idea || null,
    createdAt: row.created_at,
  };
}

export function serializeCommunityGroup(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    visibility: row.type === 'approval_based'
      ? 'approval_required'
      : row.type === 'private' || row.type === 'organization'
        ? 'private'
        : 'public',
    ownerId: row.owner_id,
    description: row.description || null,
    topics: row.topics || [],
    memberCount: row.member_count || 0,
    viewerIsMember: row.viewer_is_member ?? false,
    viewerIsRequested: row.viewer_is_requested ?? false,
    viewerIsModerator: row.viewer_is_moderator ?? false,
    viewerRole: row.viewer_role || null,
    createdAt: row.created_at,
  };
}

export function serializeNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    category: row.category,
    priority: row.priority,
    severity: row.priority,
    title: row.title,
    message: row.message,
    body: row.message,
    action: row.action || null,
    actionUrl: row.action?.url || null,
    status: row.status,
    createdAt: row.created_at,
    readAt: row.read_at || null,
    read: Boolean(row.read_at),
  };
}

export function serializeNotificationDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    notificationId: row.notification_id,
    channel: row.channel,
    state: row.state,
    attemptCount: row.attempt_count,
    deliveredAt: row.delivered_at || null,
    failureReason: row.failure_reason || null,
  };
}

export function serializeSupportTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    requesterId: row.requester_id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    assignedToId: row.assigned_to_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeSupportMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    content: row.content,
    isInternal: Boolean(row.is_internal),
    attachments: row.attachments || [],
    createdAt: row.created_at,
  };
}

export function serializeAuditEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    actorId: row.actor_id || null,
    workspaceId: row.workspace_id || null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    before: row.before || null,
    after: row.after || null,
    outcome: row.outcome,
    occurredAt: row.occurred_at,
    correlationId: row.correlation_id,
  };
}

export function serializeAdminRole(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: row.permissions || [],
    createdAt: row.created_at,
  };
}

export function serializeFeatureFlag(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    description: row.description,
    type: row.type,
    defaultValue: row.default_value,
    environment: row.environment,
    targetingRules: row.targeting_rules || [],
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

export function serializeAdminApprovalRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    actionType: row.action_type,
    actionPayload: row.action_payload,
    requestedBy: row.requested_by,
    status: row.status,
    requestedAt: row.requested_at,
    decidedBy: row.decided_by || null,
    decidedAt: row.decided_at || null,
  };
}

export const serializers = {
  user: serializeUser,
  userMe: serializeUserMe,
  session: serializeSession,
  trustedDevice: serializeTrustedDevice,
  securityEvent: serializeSecurityEvent,
  workspace: serializeWorkspace,
  workspaceMembership: serializeWorkspaceMembership,
  invitation: serializeInvitation,
  connectionShareGrant: serializeConnectionShareGrant,
  plan: serializePlan,
  planVersion: serializePlanVersion,
  planPrice: serializePlanPrice,
  subscription: serializeSubscription,
  invoice: serializeInvoice,
  payment: serializePayment,
  refund: serializeRefund,
  connection: serializeConnection,
  account: serializeAccount,
  instrument: serializeInstrument,
  order: serializeOrder,
  fill: serializeFill,
  position: serializePosition,
  syncGroup: serializeSyncGroup,
  syncOperation: serializeSyncOperation,
  riskPolicy: serializeRiskPolicy,
  riskEvaluation: serializeRiskEvaluation,
  incident: serializeIncident,
  source: serializeSource,
  sourceCandidate: serializeSourceCandidate,
  signalCandidate: serializeSignalCandidate,
  signalMessage: serializeSignalMessage,
  executionIntent: serializeExecutionIntent,
  provider: serializeProvider,
  publishedSignal: serializePublishedSignal,
  providerPlan: serializeProviderPlan,
  providerSubscriber: serializeProviderSubscriber,
  copyConfiguration: serializeCopyConfiguration,
  workflow: serializeWorkflow,
  workflowRun: serializeWorkflowRun,
  simulationEnvironment: serializeSimulationEnvironment,
  simulationRun: serializeSimulationRun,
  affiliate: serializeAffiliate,
  commissionAccrual: serializeCommissionAccrual,
  payout: serializePayout,
  developerApplication: serializeDeveloperApplication,
  apiCredential: serializeApiCredential,
  webhookSubscription: serializeWebhookSubscription,
  communityProfile: serializeCommunityProfile,
  post: serializePost,
  communityGroup: serializeCommunityGroup,
  notification: serializeNotification,
  notificationDelivery: serializeNotificationDelivery,
  supportTicket: serializeSupportTicket,
  supportMessage: serializeSupportMessage,
  auditEvent: serializeAuditEvent,
  adminRole: serializeAdminRole,
  featureFlag: serializeFeatureFlag,
  adminApprovalRequest: serializeAdminApprovalRequest,
};

export default serializers;
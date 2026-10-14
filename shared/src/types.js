/**
 * SyncExc Shared Type Definitions (JSDoc)
 *
 * These are documentation-only. They power IDE hints and make the shape of
 * shared data explicit. Runtime validation happens via Joi schemas in
 * `schemas.js`.
 *
 * Every module's public payload shape is documented here so server, client,
 * and admin agree.
 */

/**
 * @typedef {string} Uuid
 * @typedef {string} IsoDateTime  ISO 8601 timestamp in UTC
 * @typedef {string} DecimalString  Exact decimal number as a string
 * @typedef {string} CurrencyCode   ISO 4217 or crypto symbol
 * @typedef {string} InstrumentSymbol
 */

/* =============================================================================
 * EVENT ENVELOPE
 * ========================================================================== */

/**
 * @typedef {Object} EventEnvelope
 * @property {Uuid}         eventId           Unique ID of this event
 * @property {string}       eventType         e.g. "user.registered"
 * @property {string}       schemaVersion     e.g. "v1"
 * @property {IsoDateTime}  occurredAt
 * @property {IsoDateTime}  ingestedAt
 * @property {Uuid}         correlationId
 * @property {Uuid}         [actorId]
 * @property {Uuid}         [workspaceId]
 * @property {string}       resourceType      e.g. "user", "order", "signal"
 * @property {string}       resourceId
 * @property {Object}       payload
 * @property {string}       [idempotencyKey]
 * @property {string}       sourceModule      e.g. "identity", "synchronization"
 */

/* =============================================================================
 * USER / SESSION
 * ========================================================================== */

/**
 * @typedef {Object} UserPublic
 * @property {Uuid}         id
 * @property {string}       email
 * @property {boolean}      emailVerified
 * @property {string}       username
 * @property {string}       displayName
 * @property {string}       [avatarUrl]
 * @property {string}       preferredLanguage
 * @property {string}       timezone
 * @property {string}       [countryCode]
 * @property {string}       status
 * @property {boolean}      mfaEnabled
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/**
 * @typedef {Object} SessionPublic
 * @property {Uuid}         id
 * @property {Uuid}         userId
 * @property {string}       [deviceLabel]
 * @property {string}       [userAgent]
 * @property {string}       [ipAddress]
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  lastActivityAt
 * @property {IsoDateTime}  expiresAt
 * @property {boolean}      isCurrent
 */

/* =============================================================================
 * WORKSPACE
 * ========================================================================== */

/**
 * @typedef {Object} Workspace
 * @property {Uuid}         id
 * @property {string}       name
 * @property {string}       type             personal | organization
 * @property {string}       status
 * @property {Uuid}         ownerId
 * @property {string}       [description]
 * @property {string}       timezone
 * @property {string}       preferredLanguage
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/**
 * @typedef {Object} WorkspaceMembership
 * @property {Uuid}         id
 * @property {Uuid}         workspaceId
 * @property {Uuid}         userId
 * @property {string}       role
 * @property {string}       status
 * @property {string[]}     extraPermissions
 * @property {IsoDateTime}  joinedAt
 */

/* =============================================================================
 * CONNECTION
 * ========================================================================== */

/**
 * @typedef {Object} ExchangeConnection
 * @property {Uuid}         id
 * @property {Uuid}         workspaceId
 * @property {Uuid}         ownerId
 * @property {string}       exchange         binance | bybit | bitget | okx
 * @property {string}       environment      live | testnet
 * @property {string}       label
 * @property {string}       status
 * @property {Object}       capabilities     { accountRead, spotTrading, derivativesTrading, ... }
 * @property {Object}       health           { state, lastSuccessfulSyncAt, dataFreshness }
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/**
 * @typedef {Object} ExchangeAccount
 * @property {Uuid}         id
 * @property {Uuid}         connectionId
 * @property {string}       accountType      spot | margin | usd_m_futures | ...
 * @property {string}       [exchangeAccountId]
 * @property {string}       status
 * @property {string[]}     supportedCapabilities
 * @property {IsoDateTime}  lastSyncAt
 */

/* =============================================================================
 * ORDER / EXECUTION
 * ========================================================================== */

/**
 * @typedef {Object} Order
 * @property {Uuid}         id
 * @property {Uuid}         connectionId
 * @property {Uuid}         accountId
 * @property {string}       [exchangeOrderId]
 * @property {string}       [clientOrderId]
 * @property {string}       instrument
 * @property {string}       marketType
 * @property {string}       side
 * @property {string}       type
 * @property {DecimalString} quantity
 * @property {DecimalString} [filledQuantity]
 * @property {DecimalString} [remainingQuantity]
 * @property {DecimalString} [price]
 * @property {DecimalString} [averageFillPrice]
 * @property {string}       status
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/**
 * @typedef {Object} ExecutionRequest
 * @property {Uuid}         id
 * @property {Uuid}         workspaceId
 * @property {Uuid}         connectionId
 * @property {Uuid}         accountId
 * @property {string}       operationType
 * @property {string}       state
 * @property {Object}       payload
 * @property {string}       [correlationId]
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/* =============================================================================
 * SYNCHRONIZATION
 * ========================================================================== */

/**
 * @typedef {Object} SyncGroup
 * @property {Uuid}         id
 * @property {Uuid}         workspaceId
 * @property {string}       name
 * @property {Uuid}         sourceConnectionId
 * @property {Uuid}         sourceAccountId
 * @property {string[]}     marketTypes
 * @property {string[]}     enabledEventTypes
 * @property {string}       mirroringMode
 * @property {string}       executionMode
 * @property {string}       status
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/**
 * @typedef {Object} SyncOperation
 * @property {Uuid}         id
 * @property {Uuid}         groupId
 * @property {string}       sourceEventType
 * @property {Object}       sourceEventPayload
 * @property {string}       status
 * @property {Array<Object>} destinations
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  [completedAt]
 */

/* =============================================================================
 * RISK
 * ========================================================================== */

/**
 * @typedef {Object} RiskDecision
 * @property {Uuid}         id
 * @property {string}       outcome            approved | blocked | confirmation_required | ...
 * @property {string}       reasonCode
 * @property {string}       [policyVersion]
 * @property {Array<Object>} checkResults
 * @property {IsoDateTime}  evaluatedAt
 */

/**
 * @typedef {Object} RiskPolicy
 * @property {Uuid}         id
 * @property {string}       name
 * @property {string}       scope
 * @property {string}       enforcementMode
 * @property {Array<Object>} rules
 * @property {string}       status
 * @property {number}       version
 * @property {IsoDateTime}  createdAt
 */

/* =============================================================================
 * SOURCES
 * ========================================================================== */

/**
 * @typedef {Object} SignalSource
 * @property {Uuid}         id
 * @property {Uuid}         workspaceId
 * @property {string}       type             telegram | discord | webhook | ...
 * @property {string}       name
 * @property {string}       status
 * @property {string}       [url]
 * @property {string}       [providerName]
 * @property {string}       [healthState]
 * @property {string}       [qualityState]
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/**
 * @typedef {Object} SourceCandidate
 * @property {Uuid}         id
 * @property {Uuid}         discoveryJobId
 * @property {string}       name
 * @property {string}       [url]
 * @property {string}       status
 * @property {number}       confidenceScore
 * @property {Object}       evidence
 * @property {IsoDateTime}  discoveredAt
 */

/* =============================================================================
 * SIGNALS
 * ========================================================================== */

/**
 * @typedef {Object} SignalCandidate
 * @property {Uuid}         id
 * @property {Uuid}         sourceId
 * @property {Uuid}         messageId
 * @property {string}       instrument
 * @property {string}       [marketType]
 * @property {string}       direction          long | short
 * @property {DecimalString} [entry]
 * @property {Object}       [entryRange]       { min, max }
 * @property {DecimalString} [stopLoss]
 * @property {DecimalString[]} [targets]
 * @property {DecimalString} [leverage]
 * @property {string}       status
 * @property {Array<Object>} issues
 * @property {string}       [eligibilityOutcome]
 * @property {IsoDateTime}  createdAt
 */

/**
 * @typedef {Object} ExecutionIntent
 * @property {Uuid}         id
 * @property {Uuid}         signalId
 * @property {Uuid}         workspaceId
 * @property {Uuid}         [syncGroupId]
 * @property {string}       status
 * @property {string}       idempotencyKey
 * @property {IsoDateTime}  createdAt
 */

/* =============================================================================
 * MARKETPLACE
 * ========================================================================== */

/**
 * @typedef {Object} Provider
 * @property {Uuid}         id
 * @property {string}       handle
 * @property {string}       displayName
 * @property {string}       accountType
 * @property {string}       moderationState
 * @property {string}       [biography]
 * @property {string[]}     supportedMarkets
 * @property {string[]}     supportedLanguages
 * @property {IsoDateTime}  createdAt
 */

/**
 * @typedef {Object} ProviderPlan
 * @property {Uuid}         id
 * @property {Uuid}         providerId
 * @property {string}       name
 * @property {Object}       pricing
 * @property {Object}       entitlements
 * @property {string}       status
 * @property {number}       version
 */

/**
 * @typedef {Object} CopyConfiguration
 * @property {Uuid}         id
 * @property {Uuid}         providerId
 * @property {Uuid}         workspaceId
 * @property {Object}       sizingRule
 * @property {string}       executionMode
 * @property {string}       status
 * @property {IsoDateTime}  createdAt
 */

/* =============================================================================
 * AUTOMATION
 * ========================================================================== */

/**
 * @typedef {Object} Workflow
 * @property {Uuid}         id
 * @property {Uuid}         workspaceId
 * @property {string}       name
 * @property {string}       status
 * @property {number}       currentVersion
 * @property {Array<Object>} versions
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/**
 * @typedef {Object} WorkflowNode
 * @property {string}       id
 * @property {string}       type
 * @property {string}       category
 * @property {Object}       config
 * @property {Object}       [position]       { x, y }
 */

/**
 * @typedef {Object} WorkflowEdge
 * @property {string}       id
 * @property {string}       source
 * @property {string}       [sourcePort]
 * @property {string}       target
 * @property {string}       [targetPort]
 */

/**
 * @typedef {Object} WorkflowRun
 * @property {Uuid}         id
 * @property {Uuid}         workflowId
 * @property {number}       version
 * @property {string}       state
 * @property {Array<Object>} steps
 * @property {string}       [triggerEventId]
 * @property {IsoDateTime}  startedAt
 * @property {IsoDateTime}  [completedAt]
 */

/* =============================================================================
 * SIMULATION
 * ========================================================================== */

/**
 * @typedef {Object} SimulationEnvironment
 * @property {Uuid}         id
 * @property {Uuid}         workspaceId
 * @property {string}       name
 * @property {string}       type
 * @property {string}       state
 * @property {Array<Object>} initialBalances
 * @property {IsoDateTime}  createdAt
 */

/**
 * @typedef {Object} SimulationRun
 * @property {Uuid}         id
 * @property {Uuid}         environmentId
 * @property {string}       state
 * @property {Object}       config
 * @property {Object}       [metrics]
 * @property {IsoDateTime}  startedAt
 * @property {IsoDateTime}  [completedAt]
 */

/* =============================================================================
 * REFERRAL
 * ========================================================================== */

/**
 * @typedef {Object} Affiliate
 * @property {Uuid}         id
 * @property {Uuid}         userId
 * @property {string}       status
 * @property {string}       payoutCurrency
 * @property {IsoDateTime}  enrolledAt
 */

/**
 * @typedef {Object} CommissionAccrual
 * @property {Uuid}         id
 * @property {Uuid}         affiliateId
 * @property {Uuid}         attributionId
 * @property {Uuid}         paymentId
 * @property {string}       type              first_payment | recurring
 * @property {string}       state
 * @property {number}       amountMinor
 * @property {string}       currency
 * @property {IsoDateTime}  accruedAt
 */

/**
 * @typedef {Object} Payout
 * @property {Uuid}         id
 * @property {Uuid}         affiliateId
 * @property {number}       amountMinor
 * @property {string}       currency
 * @property {string}       status
 * @property {string}       [providerTransactionId]
 * @property {IsoDateTime}  requestedAt
 * @property {IsoDateTime}  [completedAt]
 */

/* =============================================================================
 * DEVELOPER
 * ========================================================================== */

/**
 * @typedef {Object} DeveloperApplication
 * @property {Uuid}         id
 * @property {Uuid}         workspaceId
 * @property {Uuid}         ownerId
 * @property {string}       name
 * @property {string}       type
 * @property {string}       state
 * @property {IsoDateTime}  createdAt
 */

/**
 * @typedef {Object} ApiCredential
 * @property {Uuid}         id
 * @property {Uuid}         applicationId
 * @property {string}       environment
 * @property {string[]}     scopes
 * @property {string}       state
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  [expiresAt]
 */

/**
 * @typedef {Object} WebhookSubscription
 * @property {Uuid}         id
 * @property {Uuid}         applicationId
 * @property {string}       destinationUrl
 * @property {string[]}     eventTypes
 * @property {string}       state
 * @property {IsoDateTime}  createdAt
 */

/* =============================================================================
 * COMMUNITY
 * ========================================================================== */

/**
 * @typedef {Object} CommunityProfile
 * @property {Uuid}         id
 * @property {Uuid}         userId
 * @property {string}       handle
 * @property {string}       displayName
 * @property {string}       [biography]
 * @property {string[]}     interests
 * @property {string}       visibility
 * @property {IsoDateTime}  createdAt
 */

/**
 * @typedef {Object} Post
 * @property {Uuid}         id
 * @property {Uuid}         authorId
 * @property {string}       destinationType
 * @property {Uuid}         [destinationRefId]
 * @property {string}       content
 * @property {string[]}     topics
 * @property {Object}       engagement       { reactions, comments, shares }
 * @property {IsoDateTime}  createdAt
 */

/**
 * @typedef {Object} CommunityGroup
 * @property {Uuid}         id
 * @property {string}       name
 * @property {string}       slug
 * @property {string}       type
 * @property {string}       visibility
 * @property {Uuid}         ownerId
 * @property {number}       memberCount
 * @property {IsoDateTime}  createdAt
 */

/* =============================================================================
 * NOTIFICATIONS
 * ========================================================================== */

/**
 * @typedef {Object} Notification
 * @property {Uuid}         id
 * @property {Uuid}         userId
 * @property {string}       eventType
 * @property {string}       category
 * @property {string}       priority
 * @property {string}       title
 * @property {string}       message
 * @property {Object}       [action]
 * @property {string}       status
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  [readAt]
 */

/**
 * @typedef {Object} NotificationDelivery
 * @property {Uuid}         id
 * @property {Uuid}         notificationId
 * @property {string}       channel
 * @property {string}       state
 * @property {number}       attemptCount
 * @property {IsoDateTime}  [deliveredAt]
 * @property {string}       [failureReason]
 */

/* =============================================================================
 * SUPPORT
 * ========================================================================== */

/**
 * @typedef {Object} SupportTicket
 * @property {Uuid}         id
 * @property {string}       reference
 * @property {Uuid}         requesterId
 * @property {string}       subject
 * @property {string}       category
 * @property {string}       status
 * @property {string}       priority
 * @property {Uuid}         [assignedToId]
 * @property {IsoDateTime}  createdAt
 * @property {IsoDateTime}  updatedAt
 */

/**
 * @typedef {Object} SupportMessage
 * @property {Uuid}         id
 * @property {Uuid}         ticketId
 * @property {Uuid}         authorId
 * @property {string}       content
 * @property {boolean}      isInternal
 * @property {Array<Object>} attachments
 * @property {IsoDateTime}  createdAt
 */

/* =============================================================================
 * AUDIT
 * ========================================================================== */

/**
 * @typedef {Object} AuditEvent
 * @property {Uuid}         id
 * @property {Uuid}         [actorId]
 * @property {Uuid}         [workspaceId]
 * @property {string}       action
 * @property {string}       resourceType
 * @property {string}       resourceId
 * @property {Object}       [before]
 * @property {Object}       [after]
 * @property {string}       outcome
 * @property {IsoDateTime}  occurredAt
 * @property {Uuid}         correlationId
 */

/* =============================================================================
 * ADMIN
 * ========================================================================== */

/**
 * @typedef {Object} AdminRole
 * @property {Uuid}         id
 * @property {string}       name
 * @property {string}       description
 * @property {string[]}     permissions
 * @property {IsoDateTime}  createdAt
 */

/**
 * @typedef {Object} FeatureFlag
 * @property {Uuid}         id
 * @property {string}       key
 * @property {string}       description
 * @property {string}       type
 * @property {boolean}      defaultValue
 * @property {string}       environment
 * @property {Object}       [targetingRules]
 * @property {boolean}      enabled
 * @property {IsoDateTime}  createdAt
 */

/**
 * @typedef {Object} AdminApprovalRequest
 * @property {Uuid}         id
 * @property {string}       actionType
 * @property {Object}       actionPayload
 * @property {Uuid}         requestedBy
 * @property {string}       status
 * @property {IsoDateTime}  requestedAt
 * @property {Uuid}         [decidedBy]
 * @property {IsoDateTime}  [decidedAt]
 */

/* =============================================================================
 * EXPORTS MAP
 * ========================================================================== */

export const TYPES = Object.freeze({
  // Marker object — the JSDoc typedefs above are the actual types.
  // This exists so imports work uniformly and IDEs pick up the JSDoc.
});
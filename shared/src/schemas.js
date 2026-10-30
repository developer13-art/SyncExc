/**
 * SyncExc Shared Validation Schemas
 *
 * Joi schemas for every cross-module payload: signals, orders, subscriptions,
 * connections, sync operations, workflows, notifications, audit events, and
 * the standard event envelope.
 *
 * Server routes use `validate(schema)` middleware.
 * Client forms use `schema.validate(value)` directly.
 */

import Joi from 'joi';

/* =============================================================================
 * PRIMITIVES
 * ========================================================================== */

export const UuidSchema = Joi.string().uuid({ version: ['uuidv4', 'uuidv7'] });

export const EmailSchema = Joi.string().email({ tlds: { allow: false } }).lowercase().trim().max(254);

export const PasswordSchema = Joi.string()
  .min(12)
  .max(128)
  .pattern(/[a-z]/, 'lowercase letter')
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[0-9]/, 'digit')
  .pattern(/[^A-Za-z0-9]/, 'special character')
  .messages({
    'string.pattern.name': 'Password must contain at least one {#name}',
    'string.min': 'Password must be at least 12 characters',
  });

export const UsernameSchema = Joi.string()
  .min(3)
  .max(32)
  .pattern(/^[a-z0-9_][a-z0-9_-]*[a-z0-9_]$/, 'username')
  .lowercase()
  .trim()
  .messages({
    'string.pattern.name':
      'Username must start and end with a letter or number, and may contain hyphens and underscores',
  });

export const UrlSchema = Joi.string().uri({ scheme: ['http', 'https'] }).max(2048);

export const HttpsUrlSchema = Joi.string().uri({ scheme: ['https'] }).max(2048);

export const PhoneSchema = Joi.string().pattern(/^\+[1-9]\d{6,14}$/).messages({
  'string.pattern.base': 'Phone must be in E.164 format (e.g., +1234567890)',
});

export const CurrencySchema = Joi.string()
  .uppercase()
  .pattern(/^[A-Z]{3,10}$/)
  .messages({ 'string.pattern.base': 'Currency must be 3-10 uppercase letters' });

export const SymbolSchema = Joi.string()
  .uppercase()
  .pattern(/^[A-Z0-9]{2,20}([-/][A-Z0-9]{2,20})?$/)
  .max(40);

export const InstrumentSchema = Joi.string().uppercase().max(64);

export const DecimalStringSchema = Joi.string()
  .pattern(/^-?\d+(\.\d+)?$/)
  .max(64)
  .messages({ 'string.pattern.base': 'Must be a decimal number string' });

export const PositiveDecimalSchema = Joi.string()
  .pattern(/^\d+(\.\d+)?$/)
  .custom((value, helpers) => {
    const num = Number(value);
    if (num <= 0) return helpers.error('number.positive');
    return value;
  })
  .messages({
    'string.pattern.base': 'Must be a positive decimal number string',
    'number.positive': 'Must be greater than zero',
  });

export const TimeframeSchema = Joi.string().valid(
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M'
);

export const PaginationSchema = Joi.object({
  cursor: Joi.string().max(512).optional(),
  limit: Joi.number().integer().min(1).max(200).default(50),
  page: Joi.number().integer().min(1).optional(),
  pageSize: Joi.number().integer().min(1).max(200).optional(),
  sort: Joi.string().valid('asc', 'desc').default('desc'),
});

export const IdParamsSchema = Joi.object({
  id: UuidSchema.required(),
});

/* =============================================================================
 * IDENTITY
 * ========================================================================== */

export const RegisterRequestSchema = Joi.object({
  email: EmailSchema.required(),
  password: PasswordSchema.required(),
  username: UsernameSchema.required(),
  displayName: Joi.string().trim().min(1).max(100).required(),
  referralCode: Joi.string().trim().alphanum().min(6).max(32).uppercase().optional(),
  acceptedTerms: Joi.boolean().valid(true).required(),
  acceptedPrivacy: Joi.boolean().valid(true).required(),
  timezone: Joi.string().max(64).default('UTC'),
  preferredLanguage: Joi.string().max(8).default('en'),
});

export const LoginRequestSchema = Joi.object({
  email: EmailSchema.required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().default(false),
  deviceLabel: Joi.string().max(120).optional(),
});

export const MfaVerifyRequestSchema = Joi.object({
  challengeId: UuidSchema.required(),
  code: Joi.string().pattern(/^\d{6}$/).required(),
});

export const MfaEnrollConfirmSchema = Joi.object({
  code: Joi.string().pattern(/^\d{6}$/).required(),
});

export const PasswordChangeRequestSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: PasswordSchema.required(),
});

export const PasswordResetRequestSchema = Joi.object({
  email: EmailSchema.required(),
});

export const PasswordResetConfirmSchema = Joi.object({
  token: Joi.string().min(32).max(256).required(),
  newPassword: PasswordSchema.required(),
});

export const EmailChangeRequestSchema = Joi.object({
  newEmail: EmailSchema.required(),
  password: Joi.string().required(),
});

export const ProfileUpdateSchema = Joi.object({
  displayName: Joi.string().trim().min(1).max(100).optional(),
  username: UsernameSchema.optional(),
  preferredLanguage: Joi.string().max(8).optional(),
  timezone: Joi.string().max(64).optional(),
  countryCode: Joi.string().length(2).uppercase().optional(),
}).min(1);

/* =============================================================================
 * WORKSPACES
 * ========================================================================== */

export const CreateWorkspaceRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string().valid('organization', 'trader', 'developer').default('trader'),
  description: Joi.string().trim().max(500).optional().allow(''),
  timezone: Joi.string().max(64).default('UTC'),
  preferredLanguage: Joi.string().max(8).default('en'),
});

export const WorkspaceLifecycleRequestSchema = Joi.object({
  status: Joi.string().valid('active', 'paused', 'archived').required(),
  reason: Joi.string().trim().max(500).optional().allow(''),
});

export const UpdateWorkspaceRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).optional().allow(''),
  timezone: Joi.string().max(64).optional(),
  preferredLanguage: Joi.string().max(8).optional(),
}).min(1);

export const InviteMemberRequestSchema = Joi.object({
  email: EmailSchema.required(),
  role: Joi.string()
    .valid('administrator', 'trading_operator', 'analyst', 'viewer')
    .required(),
  expiresInDays: Joi.number().integer().min(1).max(30).default(7),
});

export const UpdateMemberRoleRequestSchema = Joi.object({
  role: Joi.string()
    .valid('administrator', 'trading_operator', 'analyst', 'viewer')
    .required(),
});

export const TransferOwnershipRequestSchema = Joi.object({
  newOwnerUserId: UuidSchema.required(),
  reason: Joi.string().trim().max(500).required(),
});

export const CreateConnectionShareGrantSchema = Joi.object({
  recipientWorkspaceId: UuidSchema.required(),
  connectionId: UuidSchema.required(),
  allowedOperations: Joi.array()
    .items(
      Joi.string().valid(
        'view_status',
        'view_balances',
        'use_in_sync',
        'execute_trades'
      )
    )
    .min(1)
    .required(),
  expiresAt: Joi.date().iso().greater('now').optional(),
  requireApproval: Joi.boolean().default(false),
});

/* =============================================================================
 * BILLING
 * ========================================================================== */

export const CreateCheckoutRequestSchema = Joi.object({
  planId: UuidSchema.required(),
  planPriceId: UuidSchema.required(),
  provider: Joi.string().valid('stripe', 'paystack', 'flutterwave').required(),
  successUrl: UrlSchema.required(),
  cancelUrl: UrlSchema.required(),
});

export const ChangePlanRequestSchema = Joi.object({
  newPlanId: UuidSchema.required(),
  newPlanPriceId: UuidSchema.required(),
  effectiveMode: Joi.string().valid('immediate', 'next_renewal').default('next_renewal'),
});

export const CancelSubscriptionRequestSchema = Joi.object({
  reason: Joi.string().trim().max(500).optional().allow(''),
  immediate: Joi.boolean().default(false),
});

export const SubmitRefundRequestSchema = Joi.object({
  paymentId: UuidSchema.required(),
  amountMinor: Joi.number().integer().positive().optional(),
  currency: CurrencySchema.optional(),
  reason: Joi.string().trim().min(10).max(1000).required(),
  supportingEvidence: Joi.array().items(HttpsUrlSchema).max(10).optional(),
});

/* =============================================================================
 * EXCHANGE CONNECTIONS
 * ========================================================================== */

export const CreateConnectionRequestSchema = Joi.object({
  exchange: Joi.string().valid('binance', 'bybit', 'bitget', 'okx').required(),
  environment: Joi.string().valid('live', 'demo', 'testnet').default('live'),
  label: Joi.string().trim().min(1).max(100).required(),
  credentials: Joi.object({
    apiKey: Joi.string().trim().min(8).max(256).required(),
    apiSecret: Joi.string().trim().min(8).max(256).required(),
    passphrase: Joi.string().trim().min(1).max(256).optional(),
  }).required(),
});

export const RotateCredentialsRequestSchema = Joi.object({
  credentials: Joi.object({
    apiKey: Joi.string().trim().min(8).max(256).required(),
    apiSecret: Joi.string().trim().min(8).max(256).required(),
    passphrase: Joi.string().trim().min(1).max(256).optional(),
  }).required(),
  reason: Joi.string().trim().max(500).optional(),
});

export const SuspendConnectionRequestSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(500).required(),
});

/* =============================================================================
 * TERMINAL / ORDERS
 * ========================================================================== */

export const SubmitOrderRequestSchema = Joi.object({
  connectionId: UuidSchema.required(),
  accountId: UuidSchema.required(),
  marketType: Joi.string().valid('spot', 'futures', 'perpetual').required(),
  instrumentId: InstrumentSchema.required(),
  side: Joi.string().valid('buy', 'sell').required(),
  type: Joi.string()
    .valid('market', 'limit', 'stop_market', 'stop_limit', 'take_profit_market', 'take_profit_limit')
    .required(),
  quantity: PositiveDecimalSchema.required(),
  price: PositiveDecimalSchema.when('type', {
    is: Joi.string().valid('limit', 'stop_limit', 'take_profit_limit'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  stopLoss: PositiveDecimalSchema.optional(),
  takeProfit: PositiveDecimalSchema.optional(),
  triggerPrice: PositiveDecimalSchema.when('type', {
    is: Joi.string().valid('stop_market', 'stop_limit', 'take_profit_market', 'take_profit_limit'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  timeInForce: Joi.string().valid('GTC', 'IOC', 'FOK', 'DAY', 'GTX').optional(),
  reduceOnly: Joi.boolean().default(false),
  clientOrderId: Joi.string().max(64).optional(),
  idempotencyKey: Joi.string().min(16).max(128).required(),
  destinationAccountIds: Joi.array().items(UuidSchema).unique().max(10).default([]),
});

export const CancelOrderRequestSchema = Joi.object({
  orderId: UuidSchema.required(),
  reason: Joi.string().trim().max(500).optional(),
});

/* =============================================================================
 * SYNCHRONIZATION
 * ========================================================================== */

export const CreateSyncGroupRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  sourceConnectionId: UuidSchema.required(),
  sourceAccountId: UuidSchema.required(),
  marketTypes: Joi.array().items(Joi.string().valid('spot', 'futures', 'perpetual')).min(1).required(),
  enabledEventTypes: Joi.array()
    .items(
      Joi.string().valid(
        'order_accepted',
        'order_filled',
        'order_partially_filled',
        'order_canceled',
        'order_rejected',
        'order_amended',
        'position_changed'
      )
    )
    .min(1)
    .required(),
  mirroringMode: Joi.string().valid('order_intent', 'fill_based', 'lifecycle_sync').required(),
  executionMode: Joi.string()
    .valid('monitor_only', 'confirm_before_execution', 'authorized_automation')
    .default('confirm_before_execution'),
});

export const AddDestinationRequestSchema = Joi.object({
  connectionId: UuidSchema.required(),
  accountId: UuidSchema.required(),
  sizingPolicyType: Joi.string()
    .valid(
      'fixed_quantity',
      'fixed_quote_value',
      'proportional_source_quantity',
      'balance_based_scaling',
      'risk_limited_sizing',
      'capped_proportional'
    )
    .required(),
  sizingPolicyConfig: Joi.object({
    fixedQuantity: PositiveDecimalSchema.optional(),
    fixedQuoteValue: PositiveDecimalSchema.optional(),
    scaleFactor: PositiveDecimalSchema.optional(),
    balanceBase: Joi.string().valid('available', 'equity', 'balance').optional(),
    balancePercentage: PositiveDecimalSchema.optional(),
    maxQuantity: PositiveDecimalSchema.optional(),
    maxNotional: PositiveDecimalSchema.optional(),
    roundingPolicy: Joi.string().valid('round_down', 'round_up', 'round_nearest').default('round_down'),
  }).required(),
  riskPolicyId: UuidSchema.optional(),
});

export const PauseSyncGroupRequestSchema = Joi.object({
  scope: Joi.string().valid('new_dispatches', 'queue_only', 'full').required(),
  reason: Joi.string().trim().min(10).max(500).required(),
  cancelOpenOrders: Joi.boolean().default(false),
});

/* =============================================================================
 * RISK
 * ========================================================================== */

export const CreateRiskPolicyRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  scope: Joi.string()
    .valid('workspace', 'sync_group', 'exchange_account', 'instrument', 'operation')
    .required(),
  scopeRef: UuidSchema.optional(),
  enforcementMode: Joi.string()
    .valid('block', 'require_confirmation', 'require_additional_approval', 'warn', 'monitor_only')
    .required(),
  rules: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid(
            'order_limit',
            'position_limit',
            'notional_limit',
            'leverage',
            'margin_health',
            'exposure_aggregation',
            'duplicate_order',
            'frequency',
            'data_freshness'
          )
          .required(),
        config: Joi.object().unknown(true).required(),
      })
    )
    .min(1)
    .required(),
  activeFrom: Joi.date().iso().optional(),
  activeUntil: Joi.date().iso().optional(),
});

export const EvaluateOperationRequestSchema = Joi.object({
  operationType: Joi.string()
    .valid('order_submission', 'order_amendment', 'order_cancellation', 'position_close')
    .required(),
  connectionId: UuidSchema.required(),
  accountId: UuidSchema.required(),
  instrumentId: InstrumentSchema.required(),
  marketType: Joi.string().valid('spot', 'futures', 'perpetual').required(),
  side: Joi.string().valid('buy', 'sell').required(),
  quantity: PositiveDecimalSchema.required(),
  price: PositiveDecimalSchema.optional(),
  orderType: Joi.string().valid('market', 'limit').required(),
  reduceOnly: Joi.boolean().default(false),
});

export const RequestEmergencyPauseRequestSchema = Joi.object({
  scope: Joi.string()
    .valid('workspace', 'sync_group', 'destination_account', 'exchange_adapter', 'instrument', 'platform_wide')
    .required(),
  scopeRef: UuidSchema.optional(),
  reason: Joi.string().trim().min(10).max(1000).required(),
});

export const ApproveOperationRequestSchema = Joi.object({
  approvalId: UuidSchema.required(),
  decision: Joi.string().valid('approved', 'rejected').required(),
  reason: Joi.string().trim().max(500).optional(),
});

/* =============================================================================
 * SOURCES
 * ========================================================================== */

export const RegisterSourceRequestSchema = Joi.object({
  type: Joi.string().valid('telegram', 'discord', 'whatsapp', 'webhook', 'website', 'rest_api', 'email').required(),
  name: Joi.string().trim().min(1).max(200).required(),
  identifier: Joi.string().trim().min(1).max(500).required(),
  url: UrlSchema.optional(),
  providerName: Joi.string().trim().max(200).optional(),
  workspaceId: UuidSchema.required(),
  marketCoverage: Joi.array()
    .items(Joi.string().valid('spot', 'futures', 'perpetual'))
    .optional(),
  exchangeCoverage: Joi.array().items(Joi.string()).optional(),
  assetCoverage: Joi.array().items(Joi.string()).optional(),
  primaryLanguage: Joi.string().max(8).optional(),
  categories: Joi.array().items(Joi.string()).optional(),
  accessMethod: Joi.string()
    .valid('public_feed', 'oauth', 'authorized_bot', 'api_credential', 'webhook')
    .required(),
});

export const CreateDiscoveryJobRequestSchema = Joi.object({
  workspaceId: UuidSchema.required(),
  filters: Joi.object({
    exchange: Joi.string().optional(),
    marketType: Joi.string().valid('spot', 'futures', 'perpetual').optional(),
    tradingStyle: Joi.string().valid('intraday', 'short_term', 'swing', 'long_term').optional(),
    asset: Joi.string().optional(),
    language: Joi.string().max(8).optional(),
    region: Joi.string().max(64).optional(),
    platform: Joi.string().valid('telegram', 'discord', 'website', 'api', 'webhook').optional(),
    sourceType: Joi.string().optional(),
    accessRequirements: Joi.string().optional(),
  }).required(),
  maxCandidates: Joi.number().integer().min(1).max(500).default(50),
});

export const SubmitReviewDecisionRequestSchema = Joi.object({
  decision: Joi.string().valid('approve', 'reject', 'request_information', 'suspend').required(),
  scope: Joi.string()
    .valid('metadata_collection', 'message_ingestion', 'sandbox_parsing', 'downstream_signal_processing')
    .optional(),
  reason: Joi.string().trim().min(10).max(2000).required(),
});

/* =============================================================================
 * SIGNALS
 * ========================================================================== */

export const IngestMessageRequestSchema = Joi.object({
  sourceId: UuidSchema.required(),
  providerMessageId: Joi.string().max(256).optional(),
  channelRef: Joi.string().max(256).optional(),
  providerTimestamp: Joi.date().iso().required(),
  contentType: Joi.string().valid('text', 'structured', 'attachment', 'mixed').required(),
  content: Joi.string().max(50000).required(),
  attachments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().max(64).required(),
        url: UrlSchema.required(),
        sizeBytes: Joi.number().integer().positive().optional(),
      })
    )
    .max(10)
    .optional(),
});

export const SubmitSignalReviewRequestSchema = Joi.object({
  decision: Joi.string().valid('confirm', 'correct', 'reject', 'link_update', 'request_more_info').required(),
  corrections: Joi.object({
    instrument: InstrumentSchema.optional(),
    direction: Joi.string().valid('long', 'short').optional(),
    entry: PositiveDecimalSchema.optional(),
    entryRange: Joi.object({
      min: PositiveDecimalSchema.required(),
      max: PositiveDecimalSchema.required(),
    }).optional(),
    stopLoss: PositiveDecimalSchema.optional(),
    targets: Joi.array().items(PositiveDecimalSchema).optional(),
    leverage: PositiveDecimalSchema.optional(),
    marketType: Joi.string().valid('spot', 'futures', 'perpetual').optional(),
  }).optional(),
  reason: Joi.string().trim().min(10).max(2000).required(),
});

export const RequestExecutionIntentRequestSchema = Joi.object({
  signalId: UuidSchema.required(),
  workspaceId: UuidSchema.optional(),
  syncGroupId: UuidSchema.optional(),
  executionMode: Joi.string()
    .valid('monitor_only', 'confirm_before_execution', 'authorized_automation', 'simulation_only')
    .required(),
});

/* =============================================================================
 * MARKETPLACE
 * ========================================================================== */

export const CreateProviderRequestSchema = Joi.object({
  handle: UsernameSchema.required(),
  displayName: Joi.string().trim().min(1).max(100).required(),
  accountType: Joi.string().valid('individual', 'organization').required(),
  biography: Joi.string().trim().max(2000).optional().allow(''),
  methodology: Joi.string().trim().max(5000).optional().allow(''),
  supportedMarkets: Joi.array().items(Joi.string().valid('spot', 'futures', 'perpetual')).min(1).required(),
  supportedLanguages: Joi.array().items(Joi.string().max(8)).min(1).required(),
});

export const PublishSignalRequestSchema = Joi.object({
  instrument: InstrumentSchema.required(),
  marketType: Joi.string().valid('spot', 'futures', 'perpetual').required(),
  direction: Joi.string().valid('long', 'short').required(),
  orderType: Joi.string().valid('market', 'limit').default('market'),
  entry: PositiveDecimalSchema.when('orderType', {
    is: 'limit',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  stopLoss: PositiveDecimalSchema.required(),
  targets: Joi.array().items(PositiveDecimalSchema).min(1).max(10).required(),
  executionAccountIds: Joi.array().items(UuidSchema).min(1).unique().required(),
  executionAmount: PositiveDecimalSchema.required(),
}).unknown(false);

export const CreateCopyConfigurationRequestSchema = Joi.object({
  providerId: UuidSchema.required(),
  providerPlanId: UuidSchema.optional(),
  destinationAccounts: Joi.array()
    .items(
      Joi.object({
        connectionId: UuidSchema.required(),
        accountId: UuidSchema.required(),
      })
    )
    .min(1)
    .required(),
  marketTypes: Joi.array().items(Joi.string().valid('spot', 'futures', 'perpetual')).min(1).required(),
  instrumentFilters: Joi.array().items(InstrumentSchema).optional(),
  sizingRule: Joi.object({
    type: Joi.string()
      .valid('fixed_amount', 'fixed_percentage', 'provider_relative', 'user_defined')
      .required(),
    config: Joi.object().unknown(true).required(),
  }).required(),
  stopLossPercent: Joi.number().greater(0).less(100).precision(4).optional(),
  takeProfitPercent: Joi.number().greater(0).less(100).precision(4).optional(),
  executionMode: Joi.string()
    .valid('monitor_only', 'confirm_before_execution', 'authorized_automation')
    .required(),
});

/* =============================================================================
 * AUTOMATION
 * ========================================================================== */

export const CreateWorkflowRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).optional().allow(''),
  workspaceId: UuidSchema.required(),
});

export const UpdateWorkflowGraphSchema = Joi.object({
  nodes: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        type: Joi.string().required(),
        category: Joi.string().required(),
        config: Joi.object().unknown(true).required(),
        position: Joi.object({
          x: Joi.number().required(),
          y: Joi.number().required(),
        }).optional(),
      })
    )
    .required(),
  edges: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        source: Joi.string().required(),
        sourcePort: Joi.string().optional(),
        target: Joi.string().required(),
        targetPort: Joi.string().optional(),
      })
    )
    .required(),
});

export const RunWorkflowTestRequestSchema = Joi.object({
  sampleEvent: Joi.object().unknown(true).required(),
  dryRun: Joi.boolean().default(true),
});

/* =============================================================================
 * SIMULATION
 * ========================================================================== */

export const CreateSimulationEnvironmentRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string()
    .valid(
      'paper_trading',
      'historical_backtest',
      'market_replay',
      'workflow_test',
      'synchronization_test',
      'scenario_test'
    )
    .required(),
  workspaceId: UuidSchema.required(),
  initialBalances: Joi.array()
    .items(
      Joi.object({
        asset: Joi.string().uppercase().max(20).required(),
        amount: PositiveDecimalSchema.required(),
      })
    )
    .min(1)
    .required(),
  exchanges: Joi.array().items(Joi.string().valid('binance', 'bybit', 'bitget', 'okx')).optional(),
});

export const StartBacktestRequestSchema = Joi.object({
  environmentId: UuidSchema.required(),
  strategyConfig: Joi.object().unknown(true).required(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
  marketDataInterval: TimeframeSchema.required(),
  feeModel: Joi.object({
    makerBps: Joi.number().min(0).required(),
    takerBps: Joi.number().min(0).required(),
  }).required(),
  slippageModel: Joi.object({
    type: Joi.string().valid('fixed', 'proportional', 'none').required(),
    config: Joi.object().unknown(true).required(),
  }).required(),
  fillModel: Joi.string()
    .valid('immediate_simplified', 'trade_based', 'order_book_based', 'partial_fill', 'latency_aware')
    .required(),
  randomSeed: Joi.number().integer().optional(),
});

/* =============================================================================
 * REFERRAL
 * ========================================================================== */

export const EnrollAffiliateRequestSchema = Joi.object({
  acceptedAgreement: Joi.boolean().valid(true).required(),
  payoutCurrency: CurrencySchema.default('USD'),
});

export const CreateReferralLinkRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  campaignLabel: Joi.string().trim().max(100).optional(),
  trackingParams: Joi.object().unknown(true).optional(),
});

export const RequestPayoutRequestSchema = Joi.object({
  methodId: UuidSchema.required(),
  amountMinor: Joi.number().integer().positive().required(),
  currency: CurrencySchema.required(),
});

/* =============================================================================
 * DEVELOPER
 * ========================================================================== */

export const RegisterApplicationRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  workspaceId: UuidSchema.required(),
  type: Joi.string().valid('personal', 'organization', 'third_party').required(),
  redirectUris: Joi.array().items(HttpsUrlSchema).max(10).optional(),
  website: HttpsUrlSchema.optional(),
  privacyPolicyUrl: HttpsUrlSchema.optional(),
  supportContact: EmailSchema.optional(),
});

export const CreateCredentialRequestSchema = Joi.object({
  applicationId: UuidSchema.required(),
  environment: Joi.string().valid('sandbox', 'production').required(),
  scopes: Joi.array().items(Joi.string()).min(1).required(),
  workspaceId: UuidSchema.required(),
  expiresInDays: Joi.number().integer().min(1).max(365).optional(),
});

export const CreateWebhookSubscriptionSchema = Joi.object({
  applicationId: UuidSchema.required(),
  workspaceId: UuidSchema.required(),
  destinationUrl: HttpsUrlSchema.required(),
  eventTypes: Joi.array().items(Joi.string()).min(1).required(),
  resourceFilters: Joi.object().unknown(true).optional(),
});

/* =============================================================================
 * COMMUNITY
 * ========================================================================== */

export const UpdateCommunityProfileSchema = Joi.object({
  displayName: Joi.string().trim().min(1).max(100).optional(),
  handle: UsernameSchema.optional(),
  biography: Joi.string().trim().max(500).optional().allow(''),
  longIntroduction: Joi.string().trim().max(5000).optional().allow(''),
  preferredLanguage: Joi.string().max(8).optional(),
  interests: Joi.array().items(Joi.string().max(64)).max(20).optional(),
  skills: Joi.array().items(Joi.string().max(64)).max(20).optional(),
  website: UrlSchema.optional().allow(''),
}).min(1);

export const CreatePostRequestSchema = Joi.object({
  destination: Joi.object({
    type: Joi.string().valid('public_feed', 'group', 'workspace_discussion').required(),
    refId: UuidSchema.optional(),
  }).required(),
  content: Joi.string().trim().min(1).max(10000).required(),
  topics: Joi.array().items(Joi.string().max(64)).max(10).optional(),
  attachments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().max(64).required(),
        url: UrlSchema.required(),
      })
    )
    .max(10)
    .optional(),
  allowComments: Joi.boolean().default(true),
});

export const CreateGroupRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  slug: UsernameSchema.required(),
  description: Joi.string().trim().max(2000).required(),
  type: Joi.string().valid('public', 'private', 'approval_based', 'organization').required(),
  topics: Joi.array().items(Joi.string().max(64)).max(10).optional(),
  language: Joi.string().max(8).default('en'),
  workspaceId: UuidSchema.optional(),
});

export const SubmitReportRequestSchema = Joi.object({
  resourceType: Joi.string().valid('post', 'comment', 'profile', 'group', 'analysis').required(),
  resourceId: UuidSchema.required(),
  reason: Joi.string()
    .valid(
      'spam',
      'harassment',
      'impersonation',
      'fraudulent_claims',
      'misleading_content',
      'private_info_disclosure',
      'malicious_links',
      'copyright',
      'other'
    )
    .required(),
  details: Joi.string().trim().max(2000).optional(),
});

/* =============================================================================
 * NOTIFICATIONS
 * ========================================================================== */

export const UpdateNotificationPreferencesSchema = Joi.object({
  channels: Joi.object({
    in_app: Joi.boolean().optional(),
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
  }).optional(),
  categories: Joi.object().unknown(true).optional(),
  quietHours: Joi.object({
    enabled: Joi.boolean().required(),
    start: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    end: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
    timezone: Joi.string().max(64).optional(),
    daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).optional(),
  }).optional(),
}).min(1);

export const RegisterPushDeviceSchema = Joi.object({
  endpoint: HttpsUrlSchema.required(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required(),
  }).required(),
  deviceLabel: Joi.string().trim().max(120).optional(),
});

/* =============================================================================
 * SUPPORT
 * ========================================================================== */

export const CreateTicketRequestSchema = Joi.object({
  subject: Joi.string().trim().min(3).max(200).required(),
  category: Joi.string()
    .valid(
      'account_access',
      'billing_subscription',
      'exchange_connections',
      'orders_execution',
      'trade_synchronization',
      'risk_safety',
      'signals_sources',
      'automation_workflows',
      'developer_api',
      'community_collaboration',
      'bug_feature',
      'other'
    )
    .required(),
  issueType: Joi.string().trim().max(100).optional(),
  description: Joi.string().trim().min(20).max(20000).required(),
  affectedWorkspaceId: UuidSchema.optional(),
  affectedResource: Joi.object({
    type: Joi.string().required(),
    id: Joi.string().required(),
  }).optional(),
  occurrenceTime: Joi.date().iso().optional(),
  impact: Joi.string().trim().max(2000).optional(),
  preferredLanguage: Joi.string().max(8).default('en'),
});

export const ReplyToTicketRequestSchema = Joi.object({
  message: Joi.string().trim().min(1).max(20000).required(),
  attachmentIds: Joi.array().items(UuidSchema).max(10).optional(),
});

export const AddInternalNoteSchema = Joi.object({
  content: Joi.string().trim().min(1).max(20000).required(),
  mentions: Joi.array().items(UuidSchema).max(20).optional(),
});

export const EscalateTicketRequestSchema = Joi.object({
  category: Joi.string()
    .valid(
      'technical',
      'execution_integrity',
      'risk_safety',
      'security',
      'billing',
      'developer_integration',
      'platform_incident'
    )
    .required(),
  reason: Joi.string().trim().min(10).max(2000).required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional(),
});

/* =============================================================================
 * ADMIN
 * ========================================================================== */

export const SuspendUserRequestSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(1000).required(),
  scope: Joi.string().valid('full', 'sign_in_only', 'specific_actions').required(),
  durationHours: Joi.number().integer().min(1).max(8760).optional(),
});

export const CreatePlanRequestSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_]{3,32}$/).required(),
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(2000).optional(),
  features: Joi.object().unknown(true).required(),
  limits: Joi.object().unknown(true).required(),
  prices: Joi.array()
    .items(
      Joi.object({
        currency: CurrencySchema.required(),
        amountMinor: Joi.number().integer().positive().required(),
        billingInterval: Joi.string().valid('monthly', 'yearly').required(),
      })
    )
    .min(1)
    .required(),
});

export const InitiateRefundRequestSchema = Joi.object({
  paymentId: UuidSchema.required(),
  amountMinor: Joi.number().integer().positive().required(),
  currency: CurrencySchema.required(),
  reason: Joi.string().trim().min(10).max(1000).required(),
  requireSecondApproval: Joi.boolean().default(true),
});

export const CreateFeatureFlagRequestSchema = Joi.object({
  key: Joi.string().trim().pattern(/^[a-z][a-z0-9_]{2,63}$/).required(),
  description: Joi.string().trim().min(10).max(500).required(),
  owningTeam: Joi.string().trim().max(64).required(),
  relatedModule: Joi.string().trim().max(64).required(),
  type: Joi.string().valid('release', 'operational_control', 'experiment', 'emergency_kill_switch').required(),
  defaultValue: Joi.boolean().default(false),
  environment: Joi.string().valid('development', 'staging', 'production').required(),
  targetingRules: Joi.array().items(Joi.object().unknown(true)).optional(),
  expiresAt: Joi.date().iso().optional(),
});

export const InitiateFeatureRolloutSchema = Joi.object({
  flagId: UuidSchema.required(),
  environment: Joi.string().valid('development', 'staging', 'production').required(),
  targetPercentage: Joi.number().integer().min(0).max(100).required(),
  targetRules: Joi.array().items(Joi.object().unknown(true)).optional(),
  reason: Joi.string().trim().min(10).max(500).required(),
});

export const CreateAdminRoleRequestSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).required(),
  permissions: Joi.array().items(Joi.string()).min(1).required(),
});

export const AdminApprovalDecisionSchema = Joi.object({
  decision: Joi.string().valid('approved', 'rejected').required(),
  reason: Joi.string().trim().max(1000).optional(),
});

/* =============================================================================
 * EVENT ENVELOPE (used by every domain event)
 * ========================================================================== */

export const EventEnvelopeSchema = Joi.object({
  eventId: UuidSchema.required(),
  eventType: Joi.string().max(128).required(),
  schemaVersion: Joi.string().max(32).required(),
  occurredAt: Joi.date().iso().required(),
  ingestedAt: Joi.date().iso().required(),
  correlationId: UuidSchema.required(),
  actorId: UuidSchema.allow(null).optional(),
  workspaceId: UuidSchema.allow(null).optional(),
  resourceType: Joi.string().max(64).required(),
  resourceId: Joi.string().max(128).required(),
  payload: Joi.object().unknown(true).required(),
  idempotencyKey: Joi.string().max(256).allow(null).optional(),
  sourceModule: Joi.string().max(64).required(),
});

/* =============================================================================
 * EXPORTS MAP
 * ========================================================================== */

export const SCHEMAS = Object.freeze({
  // Primitives
  UuidSchema,
  EmailSchema,
  PasswordSchema,
  UsernameSchema,
  UrlSchema,
  HttpsUrlSchema,
  PhoneSchema,
  CurrencySchema,
  SymbolSchema,
  InstrumentSchema,
  DecimalStringSchema,
  PositiveDecimalSchema,
  TimeframeSchema,
  PaginationSchema,
  IdParamsSchema,

  // Identity
  RegisterRequestSchema,
  LoginRequestSchema,
  MfaVerifyRequestSchema,
  MfaEnrollConfirmSchema,
  PasswordChangeRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  EmailChangeRequestSchema,
  ProfileUpdateSchema,

  // Workspaces
  CreateWorkspaceRequestSchema,
  UpdateWorkspaceRequestSchema,
  InviteMemberRequestSchema,
  UpdateMemberRoleRequestSchema,
  TransferOwnershipRequestSchema,
  CreateConnectionShareGrantSchema,

  // Billing
  CreateCheckoutRequestSchema,
  ChangePlanRequestSchema,
  CancelSubscriptionRequestSchema,
  SubmitRefundRequestSchema,

  // Connections
  CreateConnectionRequestSchema,
  RotateCredentialsRequestSchema,
  SuspendConnectionRequestSchema,

  // Terminal
  SubmitOrderRequestSchema,
  CancelOrderRequestSchema,

  // Synchronization
  CreateSyncGroupRequestSchema,
  AddDestinationRequestSchema,
  PauseSyncGroupRequestSchema,

  // Risk
  CreateRiskPolicyRequestSchema,
  EvaluateOperationRequestSchema,
  RequestEmergencyPauseRequestSchema,
  ApproveOperationRequestSchema,

  // Sources
  RegisterSourceRequestSchema,
  CreateDiscoveryJobRequestSchema,
  SubmitReviewDecisionRequestSchema,

  // Signals
  IngestMessageRequestSchema,
  SubmitSignalReviewRequestSchema,
  RequestExecutionIntentRequestSchema,

  // Marketplace
  CreateProviderRequestSchema,
  PublishSignalRequestSchema,
  CreateCopyConfigurationRequestSchema,

  // Automation
  CreateWorkflowRequestSchema,
  UpdateWorkflowGraphSchema,
  RunWorkflowTestRequestSchema,

  // Simulation
  CreateSimulationEnvironmentRequestSchema,
  StartBacktestRequestSchema,

  // Referral
  EnrollAffiliateRequestSchema,
  CreateReferralLinkRequestSchema,
  RequestPayoutRequestSchema,

  // Developer
  RegisterApplicationRequestSchema,
  CreateCredentialRequestSchema,
  CreateWebhookSubscriptionSchema,

  // Community
  UpdateCommunityProfileSchema,
  CreatePostRequestSchema,
  CreateGroupRequestSchema,
  SubmitReportRequestSchema,

  // Notifications
  UpdateNotificationPreferencesSchema,
  RegisterPushDeviceSchema,

  // Support
  CreateTicketRequestSchema,
  ReplyToTicketRequestSchema,
  AddInternalNoteSchema,
  EscalateTicketRequestSchema,

  // Admin
  SuspendUserRequestSchema,
  CreatePlanRequestSchema,
  InitiateRefundRequestSchema,
  CreateFeatureFlagRequestSchema,
  InitiateFeatureRolloutSchema,
  CreateAdminRoleRequestSchema,
  AdminApprovalDecisionSchema,

  // Event envelope
  EventEnvelopeSchema,
});
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  SubscriptionRequiredError,
  ValidationError,
} from '../../lib/errors.js';

const STRATEGY_STATUS = Object.freeze({
  PUBLISHED: 'published',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
});

export function createStrategyService({
  db,
  queries,
  providers,
  connections,
  events,
  getAutomation,
  logger,
}) {
  async function list({ userId, search, category, market, limit = 50 }) {
    return queries.listStrategies({ userId, search, category, market, limit });
  }

  async function get({ strategyId, userId }) {
    const strategy = await queries.findStrategyById(strategyId, userId);
    if (!strategy) throw new NotFoundError('Strategy');
    if (strategy.status !== STRATEGY_STATUS.PUBLISHED) {
      const managedProvider = await providers.getProviderForUser(userId);
      if (managedProvider?.id !== strategy.provider_id) throw new NotFoundError('Strategy');
    }
    return strategy;
  }

  async function listMine({ userId, workspaceId }) {
    const provider = await requireProviderManager(userId, workspaceId);
    return queries.listStrategiesForProvider(provider.id);
  }

  async function create({
    userId,
    workspaceId,
    workflowId,
    workflowVersionId,
    providerPlanId,
    name,
    category,
    description,
    supportedMarkets,
  }) {
    const provider = await requireProviderManager(userId, workspaceId);
    if (provider.visibility !== 'public' || provider.moderation_state !== 'approved') {
      throw new ConflictError(
        'Publish an approved Trader profile before creating a public strategy',
        'PROFILE_NOT_PUBLISHED',
      );
    }

    const workflow = await loadPublishableStrategyWorkflow({
      workflowId,
      workflowVersionId,
      workspaceId: provider.workspace_id,
    });
    const validation = await getAutomation().validation.validateDefinition({
      definition: workflow.definition,
      workspaceId: provider.workspace_id,
    });
    if (!validation.valid) {
      throw new ValidationError('The selected workflow is invalid and cannot be listed', {
        details: { errors: validation.errors },
      });
    }
    validateStrategyDefinition(workflow.definition);

    if (providerPlanId) {
      const plan = await queries.findProviderPlanById(providerPlanId);
      if (!plan || plan.provider_id !== provider.id || plan.status !== 'active') {
        throw new ValidationError('Select an active subscription plan owned by this Trader profile');
      }
    }

    return db.tx(async (tx) => {
      const strategy = await queries.insertStrategy(tx, {
        providerId: provider.id,
        workflowId: workflow.id,
        workflowVersionId: workflow.version_id,
        providerPlanId,
        name,
        category,
        description,
        supportedMarkets,
        status: STRATEGY_STATUS.PUBLISHED,
      });
      await events.publish(
        tx,
        'marketplace.strategy_published',
        { strategyId: strategy.id, providerId: provider.id, workflowId: workflow.id },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'marketplace_strategy',
          resourceId: strategy.id,
        },
      );
      return strategy;
    });
  }

  async function setStatus({ userId, workspaceId, strategyId, status }) {
    if (!Object.values(STRATEGY_STATUS).includes(status)) {
      throw new ValidationError('Invalid strategy status');
    }
    const provider = await requireProviderManager(userId, workspaceId);
    const strategy = await queries.findStrategyById(strategyId, userId);
    if (!strategy || strategy.provider_id !== provider.id) throw new NotFoundError('Strategy');
    if (strategy.status === STRATEGY_STATUS.ARCHIVED && status !== STRATEGY_STATUS.ARCHIVED) {
      throw new ConflictError('Archived strategies cannot be republished', 'INVALID_STRATEGY_STATE');
    }
    const updated = await queries.updateStrategyStatus(strategyId, status);
    if (!updated) throw new NotFoundError('Strategy');
    return updated;
  }

  async function follow({ userId, workspaceId, strategyId }) {
    const strategy = await get({ strategyId, userId });
    if (strategy.status !== STRATEGY_STATUS.PUBLISHED) throw new NotFoundError('Strategy');
    await queries.followStrategy(strategyId, userId, workspaceId);
    return queries.findStrategyById(strategyId, userId);
  }

  async function unfollow({ userId, strategyId }) {
    return { removed: await queries.unfollowStrategy(strategyId, userId) };
  }

  async function listFollows({ userId, workspaceId }) {
    return queries.listFollowedStrategies(userId, workspaceId);
  }

  async function createDeployment({
    userId,
    workspaceId,
    strategyId,
    connectionId,
    accountId,
    allocationAmount,
    maxOpenPositions,
    maxDrawdownPercent,
    dailyLossLimitPercent,
  }) {
    const strategy = await get({ strategyId, userId });
    const subscription = await queries.findActiveSubscription(strategy.provider_id, userId);
    if (!subscription) {
      throw new SubscriptionRequiredError(
        'Subscribe to this strategy provider before deploying the strategy',
        'marketplace_strategy',
      );
    }
    const amount = positiveNumber(allocationAmount, 'Allocation amount');
    const openPositionLimit = boundedInteger(maxOpenPositions, 1, 100, 'Maximum open positions');
    const drawdownLimit = boundedNumber(maxDrawdownPercent, 0, 100, 'Maximum drawdown');
    const dailyLossLimit = boundedNumber(dailyLossLimitPercent, 0, 100, 'Daily loss limit');

    const connection = await connections.requireConnectionAccess({
      connectionId,
      workspaceId,
      operation: 'execute_trades',
    });
    if (connection.status !== 'active') {
      throw new ConflictError('Connection is not active', 'CONNECTION_NOT_ACTIVE');
    }
    const account = await connections.requireAccountAccess({
      accountId,
      workspaceId,
      operation: 'execute_trades',
    });
    if (account.connection_id !== connectionId || account.status !== 'active') {
      throw new ConflictError('The selected account is not active on this connection', 'ACCOUNT_CONNECTION_MISMATCH');
    }
    await connections.requireVerifiedPermission({
      connectionId,
      permissionKey: 'trading',
    });

    const source = await loadPublishableStrategyWorkflow({
      workflowId: strategy.workflow_id,
      workflowVersionId: strategy.workflow_version_id,
    });
    validateStrategyDefinition(source.definition);
    const deployment = await db.tx(async (tx) => {
      const workflowResult = await tx.query(
        `
        INSERT INTO automation_workflows (workspace_id, name, description, status, current_version, created_by)
        VALUES ($1, $2, $3, 'draft', 1, $4)
        RETURNING *
        `,
        [
          workspaceId,
          `Strategy: ${strategy.name}`,
          `Deployed from the Marketplace strategy "${strategy.name}".`,
          userId,
        ],
      );
      const copiedWorkflow = workflowResult.rows[0];
      const versionResult = await tx.query(
        `
        INSERT INTO automation_workflow_versions (workflow_id, version, definition, is_published)
        VALUES ($1, 1, $2, false)
        RETURNING *
        `,
        [copiedWorkflow.id, JSON.stringify(source.definition)],
      );
      const copiedVersion = versionResult.rows[0];

      for (const node of source.definition.nodes) {
        await tx.query(
          `
          INSERT INTO automation_workflow_nodes (version_id, node_id, node_type, category, config, position)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            copiedVersion.id,
            node.id,
            node.type,
            node.category || 'utility',
            JSON.stringify(node.config || {}),
            node.position ? JSON.stringify(node.position) : null,
          ],
        );
      }
      for (const edge of source.definition.edges || []) {
        await tx.query(
          `
          INSERT INTO automation_workflow_edges (
            version_id, edge_id, source_node_id, source_port, target_node_id, target_port
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            copiedVersion.id,
            edge.id,
            edge.source,
            edge.sourcePort || null,
            edge.target,
            edge.targetPort || null,
          ],
        );
      }

      const schedules = await tx.query(
        `
        SELECT schedule_type, cron_expression, timezone
        FROM automation_schedules
        WHERE workflow_id = $1 AND version_id = $2 AND enabled = true
        `,
        [source.id, source.version_id],
      );
      if (schedules.rowCount === 0) {
        throw new ValidationError('The strategy workflow must have an active schedule');
      }
      for (const schedule of schedules.rows) {
        await tx.query(
          `
          INSERT INTO automation_schedules (
            workflow_id, version_id, schedule_type, cron_expression, timezone, enabled
          )
          VALUES ($1, $2, $3, $4, $5, false)
          `,
          [
            copiedWorkflow.id,
            copiedVersion.id,
            schedule.schedule_type,
            schedule.cron_expression,
            schedule.timezone,
          ],
        );
      }

      const result = await tx.query(
        `
        INSERT INTO marketplace_strategy_deployments (
          strategy_id, user_id, workspace_id, workflow_id, connection_id, account_id,
          allocation_amount, max_open_positions, max_drawdown_percent, daily_loss_limit_percent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        `,
        [
          strategy.id,
          userId,
          workspaceId,
          copiedWorkflow.id,
          connectionId,
          accountId,
          amount,
          openPositionLimit,
          drawdownLimit,
          dailyLossLimit,
        ],
      );
      return result.rows[0];
    });

    logger.info(
      { strategyId, deploymentId: deployment.id, workspaceId },
      'Marketplace strategy deployment created in draft',
    );
    return deployment;
  }

  async function activateDeployment({ userId, workspaceId, deploymentId }) {
    const deployment = await findOwnedDeployment({ deploymentId, userId, workspaceId });
    if (deployment.status === 'active') return deployment;
    if (deployment.status === 'stopped') {
      throw new ConflictError('Stopped strategy deployments cannot be restarted', 'INVALID_DEPLOYMENT_STATE');
    }
    await validateDeploymentDestination(deployment);

    return db.tx(async (tx) => {
      await tx.query(
        `UPDATE automation_workflow_versions SET is_published = true, published_at = now(), published_by = $2 WHERE workflow_id = $1`,
        [deployment.workflow_id, userId],
      );
      await tx.query(
        `UPDATE automation_workflows SET status = 'active' WHERE id = $1 AND workspace_id = $2`,
        [deployment.workflow_id, workspaceId],
      );
      await tx.query(
        `UPDATE automation_schedules SET enabled = true, next_run_at = now(), updated_at = now() WHERE workflow_id = $1`,
        [deployment.workflow_id],
      );
      const result = await tx.query(
        `UPDATE marketplace_strategy_deployments SET status = 'active', updated_at = now() WHERE id = $1 RETURNING *`,
        [deploymentId],
      );
      return result.rows[0];
    });
  }

  async function pauseDeployment({ userId, workspaceId, deploymentId }) {
    const deployment = await findOwnedDeployment({ deploymentId, userId, workspaceId });
    if (deployment.status === 'stopped') {
      throw new ConflictError('Stopped strategy deployments cannot be resumed', 'INVALID_DEPLOYMENT_STATE');
    }
    return db.tx(async (tx) => {
      await tx.query(
        `UPDATE automation_workflows SET status = 'paused' WHERE id = $1 AND workspace_id = $2`,
        [deployment.workflow_id, workspaceId],
      );
      await tx.query(
        `UPDATE automation_schedules SET enabled = false, updated_at = now() WHERE workflow_id = $1`,
        [deployment.workflow_id],
      );
      const result = await tx.query(
        `UPDATE marketplace_strategy_deployments SET status = 'paused', updated_at = now() WHERE id = $1 RETURNING *`,
        [deploymentId],
      );
      return result.rows[0];
    });
  }

  async function stopDeployment({ userId, workspaceId, deploymentId }) {
    const deployment = await findOwnedDeployment({ deploymentId, userId, workspaceId });
    return db.tx(async (tx) => {
      await tx.query(
        `UPDATE automation_workflows SET status = 'retired', archived_at = now() WHERE id = $1 AND workspace_id = $2`,
        [deployment.workflow_id, workspaceId],
      );
      await tx.query(
        `UPDATE automation_schedules SET enabled = false, updated_at = now() WHERE workflow_id = $1`,
        [deployment.workflow_id],
      );
      const result = await tx.query(
        `UPDATE marketplace_strategy_deployments SET status = 'stopped', updated_at = now() WHERE id = $1 RETURNING *`,
        [deploymentId],
      );
      return result.rows[0];
    });
  }

  async function listDeployments({ userId, workspaceId }) {
    return queries.listStrategyDeployments({ userId, workspaceId });
  }

  async function findExecutionContext(workflowId) {
    return queries.findStrategyDeploymentByWorkflow(workflowId);
  }

  async function authorizeExecution({ workflowId, instrument, reduceOnly = false }) {
    const deployment = await findExecutionContext(workflowId);
    if (!deployment || deployment.status !== 'active' || deployment.workflow_status !== 'active') {
      return { allowed: false, reason: 'Strategy deployment is not active' };
    }
    if (!reduceOnly) {
      const positions = await db.query(
        `
        SELECT count(*)::int AS count
        FROM trading_positions
        WHERE account_id = $1 AND instrument = $2 AND abs(quantity) > 0
        `,
        [deployment.account_id, instrument],
      );
      if (positions.rows[0].count >= deployment.max_open_positions) {
        return { allowed: false, reason: 'Maximum open positions reached' };
      }
    }

    const losses = await db.query(
      `
      SELECT COALESCE(SUM(closed.realized_pnl), 0)::numeric AS realized_pnl,
             COALESCE(SUM(closed_today.realized_pnl), 0)::numeric AS realized_pnl_today,
             COALESCE((
               SELECT SUM(position.unrealized_pnl)
               FROM trading_positions position
               WHERE position.account_id = $1
                 AND position.instrument = $2
                 AND abs(position.quantity) > 0
             ), 0)::numeric AS unrealized_pnl
      FROM marketplace_strategy_deployment_orders deployment_order
      JOIN trading_orders order_row ON order_row.id = deployment_order.order_id
      LEFT JOIN trading_closed_trades closed
        ON closed.account_id = order_row.account_id
       AND closed.exchange_order_id = order_row.exchange_order_id
       AND closed.instrument = $2
       AND closed.closed_at >= $3
      LEFT JOIN trading_closed_trades closed_today
        ON closed_today.account_id = order_row.account_id
       AND closed_today.exchange_order_id = order_row.exchange_order_id
       AND closed_today.instrument = $2
       AND closed_today.closed_at >= date_trunc('day', now())
      WHERE deployment_order.deployment_id = $4
      `,
      [deployment.account_id, instrument, deployment.created_at, deployment.id],
    );
    const realized = Number(losses.rows[0].realized_pnl || 0);
    const dailyRealized = Number(losses.rows[0].realized_pnl_today || 0);
    const unrealized = Number(losses.rows[0].unrealized_pnl || 0);
    const allocation = Number(deployment.allocation_amount);
    const maxDrawdown = allocation * Number(deployment.max_drawdown_percent) / 100;
    const dailyLossLimit = allocation * Number(deployment.daily_loss_limit_percent) / 100;
    if (realized + unrealized <= -maxDrawdown || dailyRealized + unrealized <= -dailyLossLimit) {
      await pauseDeploymentForRiskLimit(deployment);
      return { allowed: false, reason: 'Strategy loss limit reached; deployment paused' };
    }
    return { allowed: true, deployment };
  }

  async function recordOrder({ deploymentId, orderId }) {
    await db.tx((tx) => queries.insertStrategyDeploymentOrder(tx, deploymentId, orderId));
  }

  async function pauseDeploymentForRiskLimit(deployment) {
    await db.tx(async (tx) => {
      await tx.query(
        `UPDATE marketplace_strategy_deployments SET status = 'paused', updated_at = now() WHERE id = $1`,
        [deployment.id],
      );
      await tx.query(
        `UPDATE automation_workflows SET status = 'paused' WHERE id = $1`,
        [deployment.workflow_id],
      );
      await tx.query(
        `UPDATE automation_schedules SET enabled = false, updated_at = now() WHERE workflow_id = $1`,
        [deployment.workflow_id],
      );
    });
  }

  async function requireProviderManager(userId, workspaceId) {
    const membership = await db.query(
      `
      SELECT workspace.type, membership.role
      FROM workspaces workspace
      JOIN workspace_memberships membership ON membership.workspace_id = workspace.id
      WHERE workspace.id = $1 AND membership.user_id = $2
        AND membership.status = 'active' AND workspace.status = 'active'
      `,
      [workspaceId, userId],
    );
    if (!membership.rows[0] || membership.rows[0].type !== 'trader') {
      throw new AuthorizationError('An active Trader workspace is required', 'TRADER_WORKSPACE_REQUIRED');
    }
    if (!['owner', 'administrator'].includes(membership.rows[0].role)) {
      throw new AuthorizationError('Only Trader workspace owners or administrators can manage strategies');
    }
    const provider = await providers.getProviderForUser(userId, workspaceId);
    if (!provider) throw new NotFoundError('Trader profile');
    return provider;
  }

  async function findOwnedDeployment({ deploymentId, userId, workspaceId }) {
    const result = await db.query(
      `
      SELECT * FROM marketplace_strategy_deployments
      WHERE id = $1 AND user_id = $2 AND workspace_id = $3
      `,
      [deploymentId, userId, workspaceId],
    );
    if (!result.rows[0]) throw new NotFoundError('Strategy deployment');
    return result.rows[0];
  }

  async function validateDeploymentDestination(deployment) {
    const connection = await connections.requireConnectionAccess({
      connectionId: deployment.connection_id,
      workspaceId: deployment.workspace_id,
      operation: 'execute_trades',
    });
    if (connection.status !== 'active') {
      throw new ConflictError('Connection is not active', 'CONNECTION_NOT_ACTIVE');
    }
    const account = await connections.requireAccountAccess({
      accountId: deployment.account_id,
      workspaceId: deployment.workspace_id,
      operation: 'execute_trades',
    });
    if (account.connection_id !== deployment.connection_id || account.status !== 'active') {
      throw new ConflictError('The selected account is not active on this connection', 'ACCOUNT_CONNECTION_MISMATCH');
    }
    await connections.requireVerifiedPermission({
      connectionId: deployment.connection_id,
      permissionKey: 'trading',
    });
  }

  async function loadPublishableStrategyWorkflow({ workflowId, workflowVersionId, workspaceId }) {
    const result = await db.query(
      `
      SELECT workflow.id, workflow.workspace_id, workflow.status,
             version.id AS version_id, version.definition, version.is_published
      FROM automation_workflows workflow
      JOIN automation_workflow_versions version ON version.workflow_id = workflow.id
      WHERE workflow.id = $1
        AND ($3::uuid IS NULL OR workflow.workspace_id = $3)
        AND ($2::uuid IS NULL OR version.id = $2)
        AND workflow.status = 'active'
        AND version.is_published = true
      ORDER BY version.version DESC
      LIMIT 1
      `,
      [workflowId, workflowVersionId || null, workspaceId || null],
    );
    const workflow = result.rows[0];
    if (!workflow) throw new ValidationError('Select an active workflow with a published version');
    return workflow;
  }

  return {
    list,
    get,
    listMine,
    create,
    setStatus,
    follow,
    unfollow,
    listFollows,
    createDeployment,
    activateDeployment,
    pauseDeployment,
    stopDeployment,
    listDeployments,
    findExecutionContext,
    authorizeExecution,
    recordOrder,
  };
}

function validateStrategyDefinition(definition) {
  const nodes = definition?.nodes || [];
  const marketNodes = nodes.filter((node) => node.type === 'strategy_market_data');
  const orderNodes = nodes.filter((node) => node.type === 'strategy_place_order');
  if (marketNodes.length !== 1 || orderNodes.length === 0) {
    throw new ValidationError('A strategy workflow must contain one market-data node and at least one strategy order node');
  }
  if (!marketNodes[0].config?.symbol || !marketNodes[0].config?.marketType) {
    throw new ValidationError('Configure the strategy market-data node with a symbol and market type');
  }
  const marketSymbol = String(marketNodes[0].config.symbol).toUpperCase();
  for (const node of orderNodes) {
    if (node.config?.connectionId || node.config?.accountId) {
      throw new ValidationError('Strategy order nodes cannot contain the publisher’s exchange account IDs');
    }
    if (node.config?.instrument && String(node.config.instrument).toUpperCase() !== marketSymbol) {
      throw new ValidationError('All strategy order nodes must use the market-data node’s instrument');
    }
  }
}

function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new ValidationError(`${label} must be greater than zero`);
  return number;
}

function boundedNumber(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= minimum || number > maximum) {
    throw new ValidationError(`${label} must be greater than ${minimum} and at most ${maximum}`);
  }
  return number;
}

function boundedInteger(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new ValidationError(`${label} must be between ${minimum} and ${maximum}`);
  }
  return number;
}

export default createStrategyService;

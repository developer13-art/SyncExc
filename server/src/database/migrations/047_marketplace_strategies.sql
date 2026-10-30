CREATE TABLE marketplace_strategies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid NOT NULL REFERENCES marketplace_provider_profiles(id) ON DELETE CASCADE,
    workflow_id uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE RESTRICT,
    workflow_version_id uuid NOT NULL REFERENCES automation_workflow_versions(id) ON DELETE RESTRICT,
    provider_plan_id uuid REFERENCES marketplace_provider_plans(id) ON DELETE SET NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    supported_markets text[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'published',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_strategies_name_check CHECK (length(trim(name)) BETWEEN 1 AND 100),
    CONSTRAINT marketplace_strategies_category_check CHECK (length(trim(category)) BETWEEN 1 AND 64),
    CONSTRAINT marketplace_strategies_status_check CHECK (status IN ('published', 'paused', 'archived'))
);

CREATE INDEX marketplace_strategies_discovery_idx
    ON marketplace_strategies (status, created_at DESC);
CREATE INDEX marketplace_strategies_provider_idx
    ON marketplace_strategies (provider_id, status, created_at DESC);
CREATE TRIGGER marketplace_strategies_set_updated_at
    BEFORE UPDATE ON marketplace_strategies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE marketplace_strategy_follows (
    strategy_id uuid NOT NULL REFERENCES marketplace_strategies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (strategy_id, user_id)
);

CREATE INDEX marketplace_strategy_follows_user_idx
    ON marketplace_strategy_follows (user_id, created_at DESC);

CREATE TABLE marketplace_strategy_deployments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id uuid NOT NULL REFERENCES marketplace_strategies(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    workflow_id uuid NOT NULL UNIQUE REFERENCES automation_workflows(id) ON DELETE CASCADE,
    connection_id uuid NOT NULL REFERENCES exchange_connections(id) ON DELETE RESTRICT,
    account_id uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE RESTRICT,
    allocation_amount numeric(30, 12) NOT NULL,
    max_open_positions integer NOT NULL DEFAULT 1,
    max_drawdown_percent numeric(6, 3) NOT NULL DEFAULT 10,
    daily_loss_limit_percent numeric(6, 3) NOT NULL DEFAULT 5,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT marketplace_strategy_deployments_allocation_check CHECK (allocation_amount > 0),
    CONSTRAINT marketplace_strategy_deployments_open_positions_check CHECK (max_open_positions BETWEEN 1 AND 100),
    CONSTRAINT marketplace_strategy_deployments_drawdown_check CHECK (max_drawdown_percent > 0 AND max_drawdown_percent <= 100),
    CONSTRAINT marketplace_strategy_deployments_daily_loss_check CHECK (daily_loss_limit_percent > 0 AND daily_loss_limit_percent <= 100),
    CONSTRAINT marketplace_strategy_deployments_status_check CHECK (status IN ('draft', 'active', 'paused', 'stopped'))
);

CREATE INDEX marketplace_strategy_deployments_workspace_idx
    ON marketplace_strategy_deployments (workspace_id, status, created_at DESC);
CREATE INDEX marketplace_strategy_deployments_strategy_idx
    ON marketplace_strategy_deployments (strategy_id, status);
CREATE TRIGGER marketplace_strategy_deployments_set_updated_at
    BEFORE UPDATE ON marketplace_strategy_deployments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE marketplace_strategy_deployment_orders (
    deployment_id uuid NOT NULL REFERENCES marketplace_strategy_deployments(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES trading_orders(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (deployment_id, order_id)
);

#!/usr/bin/env node
/**
 * SyncExc — Database Seeder
 *
 * Seeds the database with the minimum data required for the application to
 * function: default roles, permissions, subscription plans, feature flags,
 * and reference data.
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   node scripts/seed.js
 *   node scripts/seed.js --admin
 *   node scripts/seed.js --demo
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, '..', '..', '.env') });
config({ path: path.resolve(__dirname, '..', '.env') });

const SEED_ADMIN = process.argv.includes('--admin');
const SEED_DEMO = process.argv.includes('--demo');

function log(...args) {
  process.stdout.write(`[seed] ${args.join(' ')}\n`);
}

function error(...args) {
  process.stderr.write(`[seed] ERROR: ${args.join(' ')}\n`);
}

/* =============================================================================
 * SEED DATA
 * ========================================================================== */

const ROLES = [
  {
    name: 'owner',
    description: 'Full authority over the workspace',
    permissions: ['*'],
    scope: 'workspace',
  },
  {
    name: 'administrator',
    description: 'Manages workspace settings, members, and configuration',
    permissions: [
      'workspace.view', 'workspace.update',
      'members.view', 'members.invite', 'members.remove', 'members.role.update',
      'connections.view', 'connections.create', 'connections.update', 'connections.disconnect',
      'connections.share', 'connections.grants.manage', 'connections.grants.revoke',
      'strategies.view', 'strategies.create', 'strategies.update',
      'sync.view', 'sync.configure', 'sync.pause', 'sync.resume',
      'trading.monitor', 'trading.request_execution', 'trading.manage_automation',
      'risk.view', 'risk.configure',
      'reports.view', 'reports.export',
      'audit.view',
      'billing.view',
    ],
    scope: 'workspace',
  },
  {
    name: 'trading_operator',
    description: 'Manages trading configurations and initiates execution',
    permissions: [
      'workspace.view',
      'members.view',
      'connections.view',
      'strategies.view', 'strategies.create', 'strategies.update',
      'sync.view', 'sync.configure', 'sync.pause', 'sync.resume',
      'trading.monitor', 'trading.request_execution', 'trading.approve_execution',
      'risk.view',
      'reports.view', 'reports.export',
    ],
    scope: 'workspace',
  },
  {
    name: 'analyst',
    description: 'Reads market data, strategies, and performance',
    permissions: [
      'workspace.view',
      'members.view',
      'connections.view',
      'strategies.view',
      'sync.view',
      'trading.monitor',
      'risk.view',
      'reports.view', 'reports.export',
    ],
    scope: 'workspace',
  },
  {
    name: 'viewer',
    description: 'Read-only access to authorized workspace resources',
    permissions: [
      'workspace.view',
      'connections.view',
      'strategies.view',
      'sync.view',
      'trading.monitor',
      'risk.view',
      'reports.view',
    ],
    scope: 'workspace',
  },
];

const ADMIN_ROLES = [
  { name: 'platform_operations', description: 'Service health and operational controls' },
  { name: 'user_support_administrator', description: 'Account status and recovery workflows' },
  { name: 'workspace_administrator', description: 'Workspace records and sharing governance' },
  { name: 'billing_administrator', description: 'Plans, subscriptions, and financial exceptions' },
  { name: 'financial_approver', description: 'Approval of refunds, adjustments, and payouts' },
  { name: 'exchange_integration_operator', description: 'Adapter status and integration releases' },
  { name: 'source_reviewer', description: 'Source validation and review decisions' },
  { name: 'referral_administrator', description: 'Referral policies, commissions, and payouts' },
  { name: 'support_operations_manager', description: 'Queues, escalation, and service metrics' },
  { name: 'feature_release_manager', description: 'Feature flags, rollouts, and rollback' },
  { name: 'security_administrator', description: 'Security events and incident response' },
  { name: 'audit_reviewer', description: 'Read-only audit access and compliance' },
  { name: 'platform_administrator', description: 'Broad platform configuration' },
];

const ADMIN_PERMISSIONS = [
  'admin.dashboard.view',
  'admin.users.view', 'admin.users.suspend', 'admin.users.restore',
  'admin.workspaces.view', 'admin.workspaces.suspend',
  'admin.plans.view', 'admin.plans.create', 'admin.plans.publish',
  'admin.subscriptions.view', 'admin.subscriptions.manage',
  'admin.payments.view', 'admin.refunds.view', 'admin.refunds.initiate', 'admin.refunds.approve',
  'admin.exchanges.view', 'admin.exchanges.restrict', 'admin.exchanges.health_check',
  'admin.sources.review', 'admin.sources.manage',
  'admin.referrals.view', 'admin.referrals.policies', 'admin.referrals.payouts',
  'admin.support.view', 'admin.support.queues',
  'admin.feature_flags.view', 'admin.feature_flags.create', 'admin.feature_flags.rollout', 'admin.feature_flags.rollback',
  'admin.roles.view', 'admin.roles.manage',
  'admin.permissions.view',
  'admin.approvals.view', 'admin.approvals.decide',
  'admin.audit.view', 'admin.audit.export',
  'admin.alerts.view', 'admin.alerts.manage',
  'admin.operation_jobs.view', 'admin.operation_jobs.cancel',
  'admin.exports.create', 'admin.exports.download',
];

const PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'For individual traders getting started with multi-exchange operations',
    features: {
      'automation.enabled': false,
      'simulation.enabled': true,
      'developerApi.enabled': false,
      'referral.enabled': true,
      'community.enabled': true,
    },
    limits: {
      'exchangeConnections.max': 2,
      'signalSources.max': 3,
      'activeWorkflows.max': 0,
      'teamMembers.max': 1,
      'workflowRuns.monthly': 0,
      'apiRequests.monthly': 0,
      'simulationRuns.monthly': 5,
    },
    prices: [
      { currency: 'USD', amountMinor: 25, billingInterval: 'monthly' },
    ],
  },
  {
    code: 'pro',
    name: 'Professional',
    description: 'For serious traders managing multiple exchanges and signal sources',
    features: {
      'automation.enabled': true,
      'simulation.enabled': true,
      'developerApi.enabled': false,
      'referral.enabled': true,
      'community.enabled': true,
    },
    limits: {
      'exchangeConnections.max': 5,
      'signalSources.max': 15,
      'activeWorkflows.max': 10,
      'teamMembers.max': 3,
      'workflowRuns.monthly': 500,
      'apiRequests.monthly': 0,
      'simulationRuns.monthly': 50,
    },
    prices: [
      { currency: 'USD', amountMinor: 50, billingInterval: 'monthly' },
    ],
  },
  {
    code: 'business',
    name: 'Business',
    description: 'For trading teams, signal providers, and small organizations',
    features: {
      'automation.enabled': true,
      'simulation.enabled': true,
      'developerApi.enabled': true,
      'referral.enabled': true,
      'community.enabled': true,
    },
    limits: {
      'exchangeConnections.max': 20,
      'signalSources.max': 50,
      'activeWorkflows.max': 100,
      'teamMembers.max': 10,
      'workflowRuns.monthly': 5000,
      'apiRequests.monthly': 100000,
      'simulationRuns.monthly': 500,
    },
    prices: [
      { currency: 'USD', amountMinor: 100, billingInterval: 'monthly' },
    ],
  },
];

const FEATURE_FLAGS = [
  { key: 'marketplace.enabled', description: 'Signal marketplace', type: 'release', defaultValue: true },
  { key: 'automation.enabled', description: 'Automation Studio', type: 'release', defaultValue: true },
  { key: 'simulation.enabled', description: 'Simulation and backtesting', type: 'release', defaultValue: true },
  { key: 'referral.enabled', description: 'Referral program', type: 'release', defaultValue: true },
  { key: 'community.enabled', description: 'Community features', type: 'release', defaultValue: true },
  { key: 'developer_api.enabled', description: 'Developer platform and public API', type: 'release', defaultValue: true },
  { key: 'signals.ai_interpretation', description: 'AI-assisted signal interpretation', type: 'operational_control', defaultValue: true },
  { key: 'sources.auto_discovery', description: 'AI-assisted source discovery', type: 'operational_control', defaultValue: true },
];

/* =============================================================================
 * SEED EXECUTION
 * ========================================================================== */

async function seedWorkspaceRoles(client) {
  for (const role of ROLES) {
    await client.query(
      `
      INSERT INTO workspace_roles (id, name, description, permissions, scope, is_system, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW())
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        permissions = EXCLUDED.permissions
      `,
      [role.name, role.description, JSON.stringify(role.permissions), role.scope]
    );
  }
  log(`seeded ${ROLES.length} workspace roles`);
}

async function seedAdminRoles(client) {
  for (const role of ADMIN_ROLES) {
    await client.query(
      `
      INSERT INTO admin_role_definitions (id, name, description, created_at)
      VALUES (gen_random_uuid(), $1, $2, NOW())
      ON CONFLICT (name) DO NOTHING
      `,
      [role.name, role.description]
    );
  }
  log(`seeded ${ADMIN_ROLES.length} admin roles`);
}

async function seedAdminPermissions(client) {
  for (const permission of ADMIN_PERMISSIONS) {
    await client.query(
      `
      INSERT INTO admin_permission_definitions (id, name, created_at)
      VALUES (gen_random_uuid(), $1, NOW())
      ON CONFLICT (name) DO NOTHING
      `,
      [permission]
    );
  }
  log(`seeded ${ADMIN_PERMISSIONS.length} admin permissions`);
}

async function seedPlans(client) {
  for (const plan of PLANS) {
    const planRow = await client.query(
      `
      INSERT INTO subscription_plans (id, code, name, description, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, 'active', NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING id
      `,
      [plan.code, plan.name, plan.description]
    );
    const planId = planRow.rows[0].id;

    const existingVersion = await client.query(
      `SELECT * FROM subscription_plan_versions WHERE plan_id = $1 ORDER BY version_number DESC LIMIT 1`,
      [planId]
    );

    let versionId;
    if (existingVersion.rowCount === 0) {
      const versionRow = await client.query(
        `
        INSERT INTO subscription_plan_versions (id, plan_id, version_number, features, limits, effective_from, published_at)
        VALUES (gen_random_uuid(), $1, 1, $2, $3, NOW(), NOW())
        RETURNING id
        `,
        [planId, JSON.stringify(plan.features), JSON.stringify(plan.limits)]
      );
      versionId = versionRow.rows[0].id;
    } else {
      versionId = existingVersion.rows[0].id;
      await client.query(
        `
        UPDATE subscription_plan_versions
        SET features = $1, limits = $2
        WHERE id = $3
        `,
        [JSON.stringify(plan.features), JSON.stringify(plan.limits), versionId]
      );
    }

    for (const price of plan.prices) {
      await client.query(
        `
        INSERT INTO subscription_plan_prices (id, plan_version_id, currency, amount_minor, billing_interval, effective_from)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING
        `,
        [versionId, price.currency, price.amountMinor, price.billingInterval]
      );
    }
  }
  log(`seeded ${PLANS.length} subscription plans`);
}

async function seedFeatureFlags(client) {
  for (const flag of FEATURE_FLAGS) {
    await client.query(
      `
      INSERT INTO admin_feature_flags (id, key, description, type, default_value, environment, enabled, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, 'production', true, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET
        description = EXCLUDED.description,
        type = EXCLUDED.type,
        default_value = EXCLUDED.default_value,
        updated_at = NOW()
      `,
      [flag.key, flag.description, flag.type, flag.defaultValue]
    );
  }
  log(`seeded ${FEATURE_FLAGS.length} feature flags`);
}

async function seedAdminUser(client) {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@syncexc.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.default.hash(password, 12);

  const username = 'syncexc_admin';
  const { rows } = await client.query(
    `
    INSERT INTO users (id, email, username, password_hash, display_name, status, email_verified_at, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, $3, 'Platform Administrator', 'active', NOW(), NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      status = 'active',
      email_verified_at = NOW(),
      updated_at = NOW()
    RETURNING id
    `,
    [email, username, passwordHash]
  );

  const userId = rows[0].id;

  // Assign platform_administrator role
  const roleRow = await client.query(
    `SELECT id FROM admin_role_definitions WHERE name = 'platform_administrator' LIMIT 1`
  );

  if (roleRow.rowCount > 0) {
    await client.query(
      `
      INSERT INTO admin_user_role_assignments (id, user_id, role_id, granted_at, granted_by)
      VALUES (gen_random_uuid(), $1, $2, NOW(), $1)
      ON CONFLICT DO NOTHING
      `,
      [userId, roleRow.rows[0].id]
    );
  }

  log(`admin user: ${email} / ${password}`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  log('connected');

  try {
    await client.query('BEGIN');
    await seedWorkspaceRoles(client);
    await seedAdminRoles(client);
    await seedAdminPermissions(client);
    await seedPlans(client);
    await seedFeatureFlags(client);

    if (SEED_ADMIN) {
      await seedAdminUser(client);
    }

    await client.query('COMMIT');
    log('seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    error(err.stack || err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  error(err.stack || err.message);
  process.exit(1);
});
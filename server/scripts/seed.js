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
import DEFAULT_WORKSPACE_ROLES from '../src/database/seeds/roles.js';
import { ADMIN_PERMISSIONS, DEFAULT_ADMIN_ROLES } from '../src/database/seeds/permissions.js';

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

// const ROLES = [
//   {
//     name: 'owner',
//     description: 'Full authority over the workspace',
//     permissions: ['*'],
//     scope: 'workspace',
//   },
//   {
//     name: 'administrator',
//     description: 'Manages workspace settings, members, and configuration',
//     permissions: [
//       'workspace.view', 'workspace.update',
//       'members.view', 'members.invite', 'members.remove', 'members.role.update',
//       'connections.view', 'connections.create', 'connections.update', 'connections.disconnect',
//       'connections.share', 'connections.grants.manage', 'connections.grants.revoke',
//       'strategies.view', 'strategies.create', 'strategies.update',
//       'sync.view', 'sync.configure', 'sync.pause', 'sync.resume',
//       'trading.monitor', 'trading.request_execution', 'trading.manage_automation',
//       'risk.view', 'risk.configure',
//       'reports.view', 'reports.export',
//       'audit.view',
//       'billing.view',
//     ],
//     scope: 'workspace',
//   },
//   {
//     name: 'trading_operator',
//     description: 'Manages trading configurations and initiates execution',
//     permissions: [
//       'workspace.view',
//       'members.view',
//       'connections.view',
//       'strategies.view', 'strategies.create', 'strategies.update',
//       'sync.view', 'sync.configure', 'sync.pause', 'sync.resume',
//       'trading.monitor', 'trading.request_execution', 'trading.approve_execution',
//       'risk.view',
//       'reports.view', 'reports.export',
//     ],
//     scope: 'workspace',
//   },
//   {
//     name: 'analyst',
//     description: 'Reads market data, strategies, and performance',
//     permissions: [
//       'workspace.view',
//       'members.view',
//       'connections.view',
//       'strategies.view',
//       'sync.view',
//       'trading.monitor',
//       'risk.view',
//       'reports.view', 'reports.export',
//     ],
//     scope: 'workspace',
//   },
//   {
//     name: 'viewer',
//     description: 'Read-only access to authorized workspace resources',
//     permissions: [
//       'workspace.view',
//       'connections.view',
//       'strategies.view',
//       'sync.view',
//       'trading.monitor',
//       'risk.view',
//       'reports.view',
//     ],
//     scope: 'workspace',
//   },
// ];

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
  const workspacesResult = await client.query(
    `SELECT id FROM workspaces ORDER BY created_at ASC`
  );

  let seededCount = 0;

  for (const workspace of workspacesResult.rows) {
    for (const role of DEFAULT_WORKSPACE_ROLES) {
      await client.query(
        `
        INSERT INTO workspace_roles (
          workspace_id,
          name,
          description,
          permissions,
          is_system
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (workspace_id, name)
        DO UPDATE SET
          description = EXCLUDED.description,
          permissions = EXCLUDED.permissions,
          is_system = EXCLUDED.is_system,
          updated_at = NOW()
        `,
        [
          workspace.id,
          role.name,
          role.description,
          role.permissions,
          role.isSystem,
        ]
      );

      seededCount += 1;
    }
  }

  log(
    `seeded ${DEFAULT_WORKSPACE_ROLES.length} default roles across ${workspacesResult.rows.length} workspaces (${seededCount} role records processed)`
  );
}


async function seedAdminRoles(client) {
  for (const role of DEFAULT_ADMIN_ROLES) {
    await client.query(
      `
      INSERT INTO admin_role_definitions (id, name, description, created_at)
      VALUES (gen_random_uuid(), $1, $2, NOW())
      ON CONFLICT (name) DO NOTHING
      `,
      [role.name, role.description]
    );
  }
  log(`seeded ${DEFAULT_ADMIN_ROLES.length} admin roles`);
}


async function seedAdminPermissions(client) {
  for (const permission of ADMIN_PERMISSIONS) {
    const permissionKey = permission.key;

    if (!permissionKey) {
      throw new Error(
        `Invalid admin permission definition: ${JSON.stringify(permission)}`
      );
    }

    const category = permission.category || permissionKey.split('.')[0] || 'general';
    const description =
      permission.description || `Allows the administrator to perform: ${permissionKey}`;

    await client.query(
      `
      INSERT INTO admin_permission_definitions (
        id,
        permission_key,
        category,
        description,
        created_at
      )
      VALUES (gen_random_uuid(), $1, $2, $3, NOW())
      ON CONFLICT (permission_key) DO UPDATE SET
        category = EXCLUDED.category,
        description = EXCLUDED.description
      `,
      [permissionKey, category, description]
    );
  }

  log(`seeded ${ADMIN_PERMISSIONS.length} admin permissions`);
}

async function seedAdminRolePermissions(client) {
  for (const role of DEFAULT_ADMIN_ROLES) {
    const roleResult = await client.query(
      `SELECT id FROM admin_role_definitions WHERE name = $1`,
      [role.name]
    );
    const roleId = roleResult.rows[0]?.id;
    if (!roleId) {
      throw new Error(`Admin role was not seeded: ${role.name}`);
    }

    const permissionResult = role.permissions.includes('*')
      ? await client.query(
          `SELECT id FROM admin_permission_definitions`
        )
      : await client.query(
          `SELECT id, permission_key
           FROM admin_permission_definitions
           WHERE permission_key = ANY($1::text[])`,
          [role.permissions]
        );

    if (!role.permissions.includes('*') && permissionResult.rowCount !== role.permissions.length) {
      const found = new Set(
        (permissionResult.rows || []).map((permission) => permission.permission_key)
      );
      const missing = role.permissions.filter((permission) => !found.has(permission));
      throw new Error(
        `Admin role ${role.name} references unknown permissions: ${missing.join(', ')}`
      );
    }

    for (const permission of permissionResult.rows) {
      await client.query(
        `INSERT INTO admin_role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, permission.id]
      );
    }
  }

  log(`seeded permission mappings for ${DEFAULT_ADMIN_ROLES.length} admin roles`);
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
  const flagMetadata = {
    'marketplace.enabled': {
      owningTeam: 'product',
      relatedModule: 'marketplace',
    },
    'automation.enabled': {
      owningTeam: 'trading',
      relatedModule: 'automation',
    },
    'simulation.enabled': {
      owningTeam: 'trading',
      relatedModule: 'simulation',
    },
    'referral.enabled': {
      owningTeam: 'growth',
      relatedModule: 'referrals',
    },
    'community.enabled': {
      owningTeam: 'product',
      relatedModule: 'community',
    },
    'developer_api.enabled': {
      owningTeam: 'platform',
      relatedModule: 'developer_api',
    },
    'signals.ai_interpretation': {
      owningTeam: 'intelligence',
      relatedModule: 'signal_interpretation',
    },
    'sources.auto_discovery': {
      owningTeam: 'intelligence',
      relatedModule: 'signal_sources',
    },
  };

  for (const flag of FEATURE_FLAGS) {
    const metadata = flagMetadata[flag.key];

    if (!metadata) {
      throw new Error(
        `Missing feature flag metadata for "${flag.key}". Add its owningTeam and relatedModule.`
      );
    }

    await client.query(
      `
      INSERT INTO admin_feature_flags (
        id,
        key,
        description,
        owning_team,
        related_module,
        type,
        default_value,
        environment,
        enabled,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'production',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (key) DO UPDATE SET
        description = EXCLUDED.description,
        owning_team = EXCLUDED.owning_team,
        related_module = EXCLUDED.related_module,
        type = EXCLUDED.type,
        default_value = EXCLUDED.default_value,
        updated_at = NOW()
      `,
      [
        flag.key,
        flag.description,
        metadata.owningTeam,
        metadata.relatedModule,
        flag.type,
        flag.defaultValue,
      ]
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
    await seedAdminRolePermissions(client);
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
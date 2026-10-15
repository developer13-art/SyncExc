/**
 * SyncExc Server — Admin plan service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createAdminPlanService({ db, queries, events, audit, logger }) {
  async function listPlans({ status } = {}) {
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $1`;
    }
    const result = await db.query(
      `
      SELECT p.*, 
        (SELECT row_to_json(v) FROM (
          SELECT * FROM subscription_plan_versions
          WHERE plan_id = p.id ORDER BY version_number DESC LIMIT 1
        ) v) AS latest_version
      FROM subscription_plans p
      ${where}
      ORDER BY p.created_at DESC
      `,
      params
    );
    return result.rows;
  }

  async function getPlan({ planId }) {
    const result = await db.query(
      `
      SELECT p.*, v.version_number AS version, v.features, v.limits,
        COALESCE(prices.items, '[]'::json) AS prices
      FROM subscription_plans p
      LEFT JOIN LATERAL (
        SELECT version_number, features, limits, id
        FROM subscription_plan_versions
        WHERE plan_id = p.id
        ORDER BY version_number DESC
        LIMIT 1
      ) v ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', price.id,
          'currency', price.currency,
          'amountMinor', price.amount_minor,
          'billingInterval', price.billing_interval
        ) ORDER BY price.effective_from DESC) AS items
        FROM subscription_plan_prices price
        WHERE price.plan_version_id = v.id
          AND price.effective_until IS NULL
      ) prices ON true
      WHERE p.id = $1
      `,
      [planId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Plan');
    return result.rows[0];
  }

  async function createPlan({ userId, code, name, description, features, limits, prices }) {
    const existing = await db.query(
      `SELECT 1 FROM subscription_plans WHERE code = $1`,
      [code]
    );
    if (existing.rows.length > 0) throw new ConflictError('Plan code exists', 'PLAN_CODE_TAKEN');

    return db.tx(async (tx) => {
      const plan = await tx.query(
        `
        INSERT INTO subscription_plans (code, name, description, status)
        VALUES ($1, $2, $3, 'draft')
        RETURNING *
        `,
        [code, name, description || null]
      );

      const planVersion = await tx.query(
        `
        INSERT INTO subscription_plan_versions (
          plan_id, version_number, features, limits, effective_from, published_at
        )
        VALUES ($1, 1, $2, $3, now(), now())
        RETURNING *
        `,
        [plan.rows[0].id, JSON.stringify(features), JSON.stringify(limits)]
      );

      for (const price of prices || []) {
        await tx.query(
          `
          INSERT INTO subscription_plan_prices (
            plan_version_id, currency, amount_minor, billing_interval, effective_from
          )
          VALUES ($1, $2, $3, $4, now())
          `,
          [planVersion.rows[0].id, price.currency, price.amountMinor, price.billingInterval]
        );
      }

      await audit.write({
        actorId: userId,
        action: 'plan.created',
        resourceType: 'subscription_plan',
        resourceId: plan.rows[0].id,
        after: { code, name, features, limits },
      });

      await events.publish(
        tx,
        'admin.plan_created',
        { planId: plan.rows[0].id, code, name },
        {
          actorId: userId,
          resourceType: 'subscription_plan',
          resourceId: plan.rows[0].id,
        }
      );

      return plan.rows[0];
    });
  }

  async function updatePlan({ userId, planId, name, description, features }) {
    const current = await getPlan({ planId });
    const normalizedFeatures = Array.isArray(features)
      ? Object.fromEntries(features.map((feature) => [feature, true]))
      : features;
    const nextFeatures = normalizedFeatures ?? current.features;
    const featuresChanged =
      normalizedFeatures !== undefined &&
      JSON.stringify(nextFeatures) !== JSON.stringify(current.features);

    if (name !== undefined || description !== undefined) {
      await db.query(
        `UPDATE subscription_plans
         SET name = COALESCE($2, name),
             description = COALESCE($3, description),
             updated_at = now()
         WHERE id = $1`,
        [planId, name ?? null, description ?? null]
      );
    }

    if (featuresChanged) {
      await createPlanVersion({
        userId,
        planId,
        features: nextFeatures,
        limits: current.limits ?? {},
        prices: current.prices ?? [],
        effectiveFrom: new Date(),
      });
    } else {
      await audit.write({
        actorId: userId,
        action: 'plan.updated',
        resourceType: 'subscription_plan',
        resourceId: planId,
        after: { name, description },
      });
    }

    return getPlan({ planId });
  }

  async function publishPlan({ planId, actorId }) {
    return db.tx(async (tx) => {
      const before = await tx.query(`SELECT status FROM subscription_plans WHERE id = $1`, [planId]);
      if (before.rows.length === 0) throw new NotFoundError('Plan');

      const updated = await tx.query(
        `
        UPDATE subscription_plans SET status = 'active', updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [planId]
      );

      await audit.write({
        actorId,
        action: 'plan.published',
        resourceType: 'subscription_plan',
        resourceId: planId,
        before: before.rows[0],
        after: { status: 'active' },
      });

      return updated.rows[0];
    });
  }

  async function retirePlan({ planId, actorId, reason }) {
    return db.tx(async (tx) => {
      const before = await tx.query(`SELECT status FROM subscription_plans WHERE id = $1`, [planId]);
      const updated = await tx.query(
        `
        UPDATE subscription_plans SET status = 'retired', updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [planId]
      );

      await audit.write({
        actorId,
        action: 'plan.retired',
        resourceType: 'subscription_plan',
        resourceId: planId,
        before: before.rows[0],
        after: { status: 'retired' },
        reason,
      });

      return updated.rows[0];
    });
  }

  async function createPlanVersion({ userId, planId, features, limits, prices, effectiveFrom }) {
    return db.tx(async (tx) => {
      const latest = await tx.query(
        `SELECT MAX(version_number) AS v FROM subscription_plan_versions WHERE plan_id = $1`,
        [planId]
      );
      const nextVersion = (latest.rows[0].v || 0) + 1;

      const version = await tx.query(
        `
        INSERT INTO subscription_plan_versions (
          plan_id, version_number, features, limits, effective_from, published_at
        )
        VALUES ($1, $2, $3, $4, $5, now())
        RETURNING *
        `,
        [
          planId,
          nextVersion,
          JSON.stringify(features),
          JSON.stringify(limits),
          effectiveFrom || new Date(),
        ]
      );

      for (const price of prices || []) {
        await tx.query(
          `
          INSERT INTO subscription_plan_prices (
            plan_version_id, currency, amount_minor, billing_interval, effective_from
          )
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            version.rows[0].id,
            price.currency,
            price.amountMinor,
            price.billingInterval,
            effectiveFrom || new Date(),
          ]
        );
      }

      await audit.write({
        actorId: userId,
        action: 'plan.version_created',
        resourceType: 'subscription_plan',
        resourceId: planId,
        after: { versionNumber: nextVersion },
      });

      return version.rows[0];
    });
  }

  return {
    listPlans,
    getPlan,
    createPlan,
    updatePlan,
    publishPlan,
    retirePlan,
    createPlanVersion,
  };
}

export default createAdminPlanService;
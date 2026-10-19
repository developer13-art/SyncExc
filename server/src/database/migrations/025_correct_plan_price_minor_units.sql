WITH price_corrections (plan_name, old_amount_minor, correct_amount_minor) AS (
  VALUES
    ('starter', 25::bigint, 2500::bigint),
    ('professional', 50::bigint, 5000::bigint),
    ('business', 100::bigint, 10000::bigint)
),
latest_plan_versions AS (
  SELECT DISTINCT ON (plan_id)
    id,
    plan_id
  FROM subscription_plan_versions
  ORDER BY plan_id, version_number DESC
)
UPDATE subscription_plan_prices AS price
SET amount_minor = correction.correct_amount_minor
FROM price_corrections AS correction
JOIN latest_plan_versions AS version ON true
JOIN subscription_plans AS plan ON plan.id = version.plan_id
WHERE price.plan_version_id = version.id
  AND lower(trim(plan.name)) = correction.plan_name
  AND price.currency = 'USD'
  AND price.billing_interval = 'monthly'
  AND price.effective_until IS NULL
  AND price.amount_minor = correction.old_amount_minor;

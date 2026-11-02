INSERT INTO users (
  email,
  email_normalized,
  email_verified_at,
  password_hash,
  username,
  username_normalized,
  display_name,
  status
)
VALUES (
  'syncexc-official-bot@system.syncexc.invalid',
  'syncexc-official-bot@system.syncexc.invalid',
  now(),
  NULL,
  'syncexc_official_bot',
  'syncexc_official_bot',
  'SyncExc Official',
  'active'
)
ON CONFLICT DO NOTHING;

INSERT INTO workspaces (name, type, status, owner_id, description, slug, visibility)
SELECT 'SyncExc Official Trader', 'trader', 'active', u.id,
       'Platform-managed marketplace profile for SyncExc Official market analysis.',
       'official', 'public'
FROM users u
WHERE u.username_normalized = 'syncexc_official_bot'
  AND NOT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.owner_id = u.id AND w.type = 'trader' AND w.slug = 'official'
  );

INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
SELECT w.id, w.owner_id, 'owner', 'active'
FROM workspaces w
JOIN users u ON u.id = w.owner_id
WHERE u.username_normalized = 'syncexc_official_bot'
  AND NOT EXISTS (
    SELECT 1 FROM workspace_memberships m
    WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
  );

INSERT INTO marketplace_provider_profiles (
  user_id,
  workspace_id,
  handle,
  display_name,
  account_type,
  moderation_state,
  biography,
  methodology,
  supported_markets,
  supported_languages,
  visibility
)
SELECT u.id,
       w.id,
       'syncexc-official',
       'SyncExc Official',
       'platform_managed',
       'approved',
       'The official SyncExc market-analysis account.',
       'Scans active supported spot and futures instruments every 15 minutes using market data and technical indicators. Published signals are informational and are never copied without a subscriber-enabled copy configuration.',
       ARRAY['spot', 'futures'],
       ARRAY['en'],
       'public'
FROM users u
JOIN workspaces w ON w.owner_id = u.id AND w.type = 'trader' AND w.slug = 'official'
WHERE u.username_normalized = 'syncexc_official_bot'
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_provider_profiles p WHERE p.workspace_id = w.id
  )
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_provider_profile_versions (provider_id, version, snapshot)
SELECT p.id, 1, to_jsonb(p)
FROM marketplace_provider_profiles p
WHERE p.handle = 'syncexc-official'
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_provider_profile_versions v
    WHERE v.provider_id = p.id AND v.version = 1
  );

INSERT INTO marketplace_provider_memberships (provider_id, user_id, role, status)
SELECT p.id, p.user_id, 'owner', 'active'
FROM marketplace_provider_profiles p
WHERE p.handle = 'syncexc-official'
ON CONFLICT (provider_id, user_id) DO NOTHING;

INSERT INTO marketplace_provider_plans (provider_id, name, pricing, entitlements, status)
SELECT p.id,
       'Official Signals',
       '{"amountMinor":0,"currency":"USD","billingInterval":"month"}'::jsonb,
       '{"signals":true,"copyTrading":true}'::jsonb,
       'active'
FROM marketplace_provider_profiles p
WHERE p.handle = 'syncexc-official'
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_provider_plans plan
    WHERE plan.provider_id = p.id AND plan.name = 'Official Signals'
  );

INSERT INTO marketplace_provider_plan_versions (plan_id, version, snapshot)
SELECT plan.id, plan.version, to_jsonb(plan)
FROM marketplace_provider_plans plan
JOIN marketplace_provider_profiles p ON p.id = plan.provider_id
WHERE p.handle = 'syncexc-official'
  AND plan.name = 'Official Signals'
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_provider_plan_versions v
    WHERE v.plan_id = plan.id AND v.version = plan.version
  );

INSERT INTO marketplace_signal_disclosures (provider_id, scope, version, content)
SELECT p.id,
       'signal',
       '1',
       'SyncExc Official signals are automated market-data analyses, not financial advice or a guarantee of results. Copying is optional and disabled until you configure and authorize it. Users are responsible for selecting their own risk limits and destinations.'
FROM marketplace_provider_profiles p
WHERE p.handle = 'syncexc-official'
  AND NOT EXISTS (
    SELECT 1 FROM marketplace_signal_disclosures d
    WHERE d.provider_id = p.id AND d.scope = 'signal' AND d.version = '1'
  );

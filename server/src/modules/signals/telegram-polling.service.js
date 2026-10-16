import { createHash, randomUUID } from 'node:crypto';
import { decrypt } from '../../lib/crypto.js';

const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_SECONDS = 5;

function channelMatches(identifier, chat) {
  const selected = String(identifier || '').trim().toLowerCase();
  if (!selected) return false;
  const id = String(chat?.id ?? '').toLowerCase();
  const username = chat?.username ? `@${String(chat.username).toLowerCase()}` : '';
  const normalized = selected
    .replace(/^https?:\/\/(www\.)?t\.me\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
  return selected === id || normalized === id ||
    normalized === username || `@${normalized.replace(/^@/, '')}` === username;
}

export function createTelegramPollingService({ db, ingestion, logger }) {
  const workerId = randomUUID();
  let timer = null;
  let stopped = false;
  let running = false;

  async function loadSelectedFeeds() {
    const result = await db.query(
      `
      SELECT s.id AS source_id, s.workspace_id, s.last_monitor_error,
             i.value AS identifier, c.id AS connection_id,
             cr.encrypted_value
      FROM signal_sources s
      JOIN signal_source_identifiers i
        ON i.source_id = s.id AND i.canonical = true
      JOIN LATERAL (
        SELECT *
        FROM signal_source_connections x
        WHERE x.source_id = s.id
        ORDER BY x.created_at DESC
        LIMIT 1
      ) c ON c.status = 'active' AND c.authorization_status = 'authorized'
      JOIN LATERAL (
        SELECT *
        FROM signal_source_credentials x
        WHERE x.connection_id = c.id AND x.revoked_at IS NULL
        ORDER BY x.created_at DESC
        LIMIT 1
      ) cr ON true
      WHERE s.type = 'telegram'
        AND s.status = 'active'
        AND s.monitoring_enabled = true
        AND i.identifier_type = 'telegram_identifier'
      `,
    );
    return result.rows;
  }

  async function acquireLease(fingerprint) {
    return db.tx(async (tx) => {
      await tx.query(
        `INSERT INTO telegram_bot_update_cursors (bot_fingerprint) VALUES ($1) ON CONFLICT DO NOTHING`,
        [fingerprint]
      );
      const result = await tx.query(
        `
        UPDATE telegram_bot_update_cursors
        SET lease_owner = $2, lease_until = now() + interval '20 seconds', updated_at = now()
        WHERE bot_fingerprint = $1
          AND (lease_until IS NULL OR lease_until < now() OR lease_owner = $2)
        RETURNING update_offset
        `,
        [fingerprint, workerId]
      );
      return result.rows[0] ? Number(result.rows[0].update_offset) : null;
    });
  }

  async function releaseLease(fingerprint, updateOffset) {
    await db.query(
      `
      UPDATE telegram_bot_update_cursors
      SET update_offset = GREATEST(update_offset, $3),
          lease_owner = NULL,
          lease_until = NULL,
          updated_at = now()
      WHERE bot_fingerprint = $1 AND lease_owner = $2
      `,
      [fingerprint, workerId, updateOffset]
    );
  }

  async function markFeedsError(feeds, message) {
    const sourceIds = feeds.map((feed) => feed.source_id);
    if (!sourceIds.length) return;
    await db.query(
      `UPDATE signal_sources SET last_monitor_error = $2, health_state = 'degraded', updated_at = now() WHERE id = ANY($1::uuid[])`,
      [sourceIds, message]
    );
  }

  async function pollBot(token, feeds) {
    const fingerprint = createHash('sha256').update(token).digest('hex');
    const currentOffset = await acquireLease(fingerprint);
    if (currentOffset === null) return;

    let nextOffset = currentOffset;
    try {
      const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
      url.searchParams.set('timeout', String(POLL_TIMEOUT_SECONDS));
      url.searchParams.set('limit', '100');
      url.searchParams.set('allowed_updates', JSON.stringify(['message', 'channel_post']));
      if (currentOffset > 0) url.searchParams.set('offset', String(currentOffset));

      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !Array.isArray(payload.result)) {
        await markFeedsError(feeds, 'Telegram polling failed. Check the bot connection and retry.');
        return;
      }

      for (const update of payload.result) {
        nextOffset = Math.max(nextOffset, Number(update.update_id) + 1);
        const message = update.channel_post ?? update.message;
        const body = message?.text ?? message?.caption;
        if (!message || !body) continue;
        const selectedFeed = feeds.find((feed) => channelMatches(feed.identifier, message.chat));
        if (!selectedFeed) continue;

        await ingestion.ingestMessage({
          workspaceId: selectedFeed.workspace_id,
          sourceId: selectedFeed.source_id,
          providerMessageId: String(message.message_id),
          channelRef: String(message.chat.id),
          providerTimestamp: message.date ? new Date(message.date * 1000) : new Date(),
          contentType: message.text ? 'text' : 'caption',
          content: body,
          attachments: [],
        });
      }
      await db.query(
        `UPDATE signal_sources SET last_monitor_error = NULL, health_state = 'healthy', updated_at = now() WHERE id = ANY($1::uuid[])`,
        [feeds.map((feed) => feed.source_id)]
      );
    } catch (error) {
      // Do not log the Telegram URL or provider token.
      logger.warn({ provider: 'telegram', feedCount: feeds.length, errorName: error?.name }, 'Telegram polling failed');
      await markFeedsError(feeds, 'Telegram polling failed. Check the bot connection and retry.');
    } finally {
      await releaseLease(fingerprint, nextOffset).catch(() => {});
    }
  }

  async function poll() {
    if (running || stopped) return;
    running = true;
    try {
      const feeds = await loadSelectedFeeds();
      const groups = new Map();
      for (const feed of feeds) {
        try {
          const credentials = JSON.parse(decrypt(feed.encrypted_value));
          const token = String(credentials.botToken || '');
          if (!token) continue;
          const fingerprint = createHash('sha256').update(token).digest('hex');
          const group = groups.get(fingerprint) ?? { token, feeds: [] };
          group.feeds.push(feed);
          groups.set(fingerprint, group);
        } catch (error) {
          logger.warn({ provider: 'telegram', sourceId: feed.source_id, errorName: error?.name }, 'Could not decrypt Telegram credentials');
          await markFeedsError([feed], 'Telegram credentials could not be decrypted. Reconnect this source.');
        }
      }
      await Promise.all([...groups.values()].map(({ token, feeds: groupFeeds }) => pollBot(token, groupFeeds)));
    } catch (error) {
      logger.warn({ errorName: error?.name }, 'Signal source poll failed');
    } finally {
      running = false;
    }
  }

  function schedule() {
    if (stopped) return;
    timer = setTimeout(async () => {
      await poll();
      schedule();
    }, POLL_INTERVAL_MS);
    timer.unref?.();
  }

  function start() {
    if (timer || stopped) return;
    timer = setTimeout(async () => {
      timer = null;
      await poll();
      schedule();
    }, 1_000);
    timer.unref?.();
  }

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { start, stop, poll };
}

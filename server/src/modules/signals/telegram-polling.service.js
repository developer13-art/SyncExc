import { createHash, randomUUID } from 'node:crypto';
import { decrypt } from '../../lib/crypto.js';
import { createTelegramClient, toTelegramInputPeer } from '../sources/telegram-client.js';

const POLL_INTERVAL_MS = 15_000;
export function createTelegramPollingService({ db, ingestion, logger, config }) {
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
      JOIN workspaces w ON w.id = s.workspace_id AND w.status = 'active'
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

  async function markFeedsError(feeds, message) {
    const sourceIds = feeds.map((feed) => feed.source_id);
    if (!sourceIds.length) return;
    await db.query(
      `UPDATE signal_sources SET last_monitor_error = $2, health_state = 'degraded', updated_at = now() WHERE id = ANY($1::uuid[])`,
      [sourceIds, message],
    );
  }

  async function pollUserSession(sessionString, feeds) {
    const client = createTelegramClient(sessionString, config);
    try {
      await client.connect();
      if (!(await client.checkAuthorization())) {
        for (const feed of feeds) {
          await db.query(
            `UPDATE signal_sources SET last_monitor_error = $2, health_state = 'authorization_required', updated_at = now() WHERE id = $1`,
            [feed.source_id, 'Telegram authorization expired. Reconnect this source.'],
          );
          await db.query(
            `UPDATE signal_source_connections SET authorization_status = 'required', updated_at = now() WHERE id = $1`,
            [feed.connection_id],
          );
        }
        return;
      }

      for (const feed of feeds) {
        try {
          const cursorResult = await db.query(
            'SELECT last_message_id FROM telegram_user_message_cursors WHERE source_id = $1',
            [feed.source_id],
          );
          let lastMessageId = Number(cursorResult.rows[0]?.last_message_id || 0);
          const peer = toTelegramInputPeer(feed.selected_peer);
          let page;
          do {
            page = await client.getMessages(peer, { limit: 100, minId: lastMessageId });
            page.sort((a, b) => Number(a.id) - Number(b.id));
            let advanced = false;
            for (const message of page) {
              const messageId = Number(message.id);
              if (!Number.isSafeInteger(messageId) || messageId <= lastMessageId) continue;
              const body = message.message || message.text || message.caption;
              if (body) {
                const messageDate =
                  message.date instanceof Date ? message.date : new Date(Number(message.date) * 1000);
                await ingestion.ingestMessage({
                  workspaceId: feed.workspace_id,
                  sourceId: feed.source_id,
                  providerMessageId: String(messageId),
                  channelRef: feed.identifier,
                  providerTimestamp: Number.isNaN(messageDate.getTime()) ? new Date() : messageDate,
                  contentType: message.message || message.text ? 'text' : 'caption',
                  content: body,
                  attachments: [],
                });
              }
              await db.query(
                `
                INSERT INTO telegram_user_message_cursors (source_id, last_message_id)
                VALUES ($1, $2)
                ON CONFLICT (source_id) DO UPDATE
                SET last_message_id = GREATEST(telegram_user_message_cursors.last_message_id, EXCLUDED.last_message_id),
                    updated_at = now()
                `,
                [feed.source_id, messageId],
              );
              lastMessageId = messageId;
              advanced = true;
            }
            if (!advanced) break;
          } while (page.length >= 100);
          await db.query(
            `UPDATE signal_sources SET last_monitor_error = NULL, health_state = 'healthy', updated_at = now() WHERE id = $1`,
            [feed.source_id],
          );
          await db.query(
            `UPDATE signal_source_connections SET authorization_status = 'authorized', status = 'active', updated_at = now() WHERE id = $1`,
            [feed.connection_id],
          );
        } catch (error) {
          logger.warn(
            { provider: 'telegram', sourceId: feed.source_id, errorName: error?.name },
            'Telegram user-channel polling failed',
          );
          await markFeedsError(
            [feed],
            'Telegram polling failed. Check the Telegram connection and retry.',
          );
        }
      }
    } catch (error) {
      logger.warn(
        { provider: 'telegram', feedCount: feeds.length, errorName: error?.name },
        'Telegram user-session polling failed',
      );
      await markFeedsError(
        feeds,
        'Telegram polling failed. Check the Telegram connection and retry.',
      );
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  async function poll() {
    if (running || stopped) return;
    running = true;
    try {
      const feeds = await loadSelectedFeeds();
      const userGroups = new Map();
      for (const feed of feeds) {
        try {
          const credentials = JSON.parse(decrypt(feed.encrypted_value));
          if (credentials.sessionString && credentials.selectedPeer) {
            const fingerprint = createHash('sha256')
              .update(credentials.sessionString)
              .digest('hex');
            const group = userGroups.get(fingerprint) ?? {
              sessionString: credentials.sessionString,
              feeds: [],
            };
            group.feeds.push({ ...feed, selected_peer: credentials.selectedPeer });
            userGroups.set(fingerprint, group);
          } else {
            await markFeedsError([feed], 'Telegram account session is missing. Reconnect this source.');
          }
        } catch (error) {
          logger.warn(
            { provider: 'telegram', sourceId: feed.source_id, errorName: error?.name },
            'Could not decrypt Telegram credentials',
          );
          await markFeedsError(
            [feed],
            'Telegram credentials could not be decrypted. Reconnect this source.',
          );
        }
      }
      await Promise.all([
        ...[...userGroups.values()].map(({ sessionString, feeds: groupFeeds }) =>
          pollUserSession(sessionString, groupFeeds),
        ),
      ]);
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

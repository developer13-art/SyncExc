import assert from 'node:assert/strict';
import { test } from 'node:test';
import bigInt from 'big-integer';
import { Api } from 'teleproto';
import {
  createTelegramClient,
  getTelegramPeer,
  listTelegramDialogs,
  requireTelegramCredentials,
  toTelegramInputPeer,
} from '../../src/modules/sources/telegram-client.js';

test('creates an input peer for a private channel without exposing its access hash', async () => {
  const entity = {
    className: 'Channel',
    id: bigInt('1234567890123'),
    accessHash: bigInt('9876543210987'),
    username: 'market_news',
    title: 'Market News',
  };
  const peer = getTelegramPeer(entity);
  const listed = await listTelegramDialogs({
    async getDialogs() {
      return [{ entity, title: 'Market News' }];
    },
  });

  assert.deepEqual(peer, {
    type: 'channel',
    id: '1234567890123',
    accessHash: '9876543210987',
  });
  assert.deepEqual(listed, [
    {
      id: 'channel:1234567890123',
      title: 'Market News',
      type: 'channel',
      username: 'market_news',
      url: 'https://t.me/market_news',
    },
  ]);
  assert.equal('accessHash' in listed[0], false);
  assert.ok(toTelegramInputPeer(peer) instanceof Api.InputPeerChannel);
});

test('creates an input peer for a basic Telegram group', () => {
  const peer = getTelegramPeer({ className: 'Chat', id: bigInt('1234') });
  assert.deepEqual(peer, { type: 'chat', id: '1234' });
  assert.ok(toTelegramInputPeer(peer) instanceof Api.InputPeerChat);
});

test('requires Telegram app credentials before connecting', () => {
  assert.throws(
    () => requireTelegramCredentials({ telegram: {} }),
    /TELEGRAM_API_ID and TELEGRAM_API_HASH/,
  );
});

test('allows Telegram client to retry DC migration during phone login', () => {
  const client = createTelegramClient('', {
    telegram: { apiId: 123, apiHash: 'app-hash' },
  });

  assert.ok(client._requestRetries > 1);
});

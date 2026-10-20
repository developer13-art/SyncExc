import bigInt from 'big-integer';
import { TelegramClient } from 'teleproto';
import { StringSession } from 'teleproto/sessions';
import { Api } from 'teleproto';
import { ValidationError } from '../../lib/errors.js';

export function requireTelegramCredentials(config) {
  const apiId = Number(config?.telegram?.apiId);
  const apiHash = config?.telegram?.apiHash;
  if (!Number.isSafeInteger(apiId) || apiId <= 0 || !apiHash) {
    throw new ValidationError(
      'Telegram login is not configured. Set TELEGRAM_API_ID and TELEGRAM_API_HASH on the server.',
    );
  }
  return { apiId, apiHash };
}

export function createTelegramClient(sessionString, config) {
  const { apiId, apiHash } = requireTelegramCredentials(config);
  return new TelegramClient(new StringSession(sessionString || ''), apiId, apiHash, {
    connectionRetries: 2,
    requestRetries: 5,
  });
}

export function getTelegramPeer(entity) {
  if (entity?.className === 'Channel' && entity.accessHash != null) {
    return {
      type: 'channel',
      id: entity.id.toString(),
      accessHash: entity.accessHash.toString(),
    };
  }
  if (entity?.className === 'Chat') {
    return { type: 'chat', id: entity.id.toString() };
  }
  return null;
}

export function toTelegramInputPeer(peer) {
  if (peer?.type === 'channel' && peer.id && peer.accessHash) {
    return new Api.InputPeerChannel({
      channelId: bigInt(peer.id),
      accessHash: bigInt(peer.accessHash),
    });
  }
  if (peer?.type === 'chat' && peer.id) {
    return new Api.InputPeerChat({ chatId: bigInt(peer.id) });
  }
  throw new ValidationError(
    'The selected Telegram channel is no longer available. Select it again.',
  );
}

export function listTelegramDialogs(client) {
  return client.getDialogs({ limit: 500 }).then((dialogs) =>
    dialogs.flatMap((dialog) => {
      const peer = getTelegramPeer(dialog.entity);
      if (!peer) return [];
      const title = String(dialog.title || dialog.entity.title || '').trim();
      if (!title) return [];
      const username = dialog.entity.username || null;
      const type = peer.type === 'chat' || dialog.entity.megagroup ? 'group' : 'channel';
      return [
        {
          id: `${peer.type}:${peer.id}`,
          title,
          type,
          username,
          url: username ? `https://t.me/${username}` : null,
        },
      ];
    }),
  );
}

export default createTelegramClient;

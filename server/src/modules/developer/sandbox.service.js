/**
 * SyncExc Server — Sandbox service
 *
 * Provides isolated testing data. Sandbox credentials never reach production
 * resources because the environment is checked at the credential level.
 */

import { randomBytes } from 'node:crypto';

export function createSandboxService({ db, queries, logger }) {
  async function createSandboxSession({ userId, workspaceId, applicationId }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new Error('Application not found');

    const sessionRef = `sbx_${randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return db.tx(async (tx) => {
      return queries.insertSandboxSession(tx, {
        applicationId,
        sessionRef,
        expiresAt,
      });
    });
  }

  /**
   * Return synthetic data fixtures for the sandbox.
   */
  async function getFixtures({ sessionRef, resourceType }) {
    const session = await queries.findSandboxSessionByRef(sessionRef);
    if (!session) throw new Error('Sandbox session not found or expired');

    const fixtures = {
      workspace: {
        id: 'sandbox_workspace',
        name: 'Sandbox Workspace',
        type: 'organization',
      },
      connection: {
        id: 'sandbox_connection',
        exchange_code: 'binance',
        environment: 'testnet',
        status: 'active',
      },
      account: {
        id: 'sandbox_account',
        account_type: 'spot',
        status: 'active',
      },
      instruments: [
        {
          exchange_symbol: 'BTCUSDT',
          market_type: 'spot',
          base_asset: 'BTC',
          quote_asset: 'USDT',
          tick_size: '0.01',
          quantity_step: '0.00001',
        },
        {
          exchange_symbol: 'ETHUSDT',
          market_type: 'spot',
          base_asset: 'ETH',
          quote_asset: 'USDT',
          tick_size: '0.01',
          quantity_step: '0.0001',
        },
      ],
      balances: [
        { asset: 'USDT', free: '100000', used: '0', total: '100000' },
        { asset: 'BTC', free: '1', used: '0', total: '1' },
      ],
      orders: [],
      signals: [
        {
          id: 'sandbox_signal_1',
          instrument: 'BTC/USDT',
          direction: 'long',
          entry: '60000',
          stopLoss: '59000',
          targets: ['61000', '62000'],
        },
      ],
    };

    if (resourceType) return fixtures[resourceType] || null;
    return fixtures;
  }

  /**
   * Simulate a webhook event delivery to the developer's endpoint. Does not
   * touch real events — generates a synthetic event with the sandbox marker.
   */
  async function simulateWebhookEvent({ sessionRef, subscriptionId, eventType }) {
    const session = await queries.findSandboxSessionByRef(sessionRef);
    if (!session) throw new Error('Sandbox session not found');

    const sub = await queries.findWebhookSubscriptionById(subscriptionId);
    if (!sub || sub.application_id !== session.application_id) {
      throw new Error('Subscription does not belong to sandbox session');
    }

    // Create a synthetic event
    const event = await db.tx(async (tx) => {
      return queries.insertWebhookEvent(tx, {
        eventType,
        schemaVersion: 'v1',
        payload: {
          __sandbox: true,
          sessionRef,
          message: 'Synthetic sandbox event',
          timestamp: new Date().toISOString(),
        },
        resourceType: 'sandbox',
        resourceId: sessionRef,
      });
    });

    const delivery = await db.tx(async (tx) => {
      return queries.insertWebhookDelivery(tx, {
        subscriptionId,
        eventId: event.id,
        nextRetryAt: new Date(),
      });
    });

    return { eventId: event.id, deliveryId: delivery?.id || null };
  }

  return {
    createSandboxSession,
    getFixtures,
    simulateWebhookEvent,
  };
}

export default createSandboxService;
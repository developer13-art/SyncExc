import { describe, expect, it } from 'vitest';

import { buildTriggerRegistrationPayload } from './Triggers.jsx';

describe('buildTriggerRegistrationPayload', () => {
  it('associates a supported event and structured filter with the selected workflow version', () => {
    expect(buildTriggerRegistrationPayload('version-3', {
      type: 'signal_published',
      name: 'BTC signals',
      filter: '{"symbol":"BTCUSDT"}',
    })).toEqual({
      versionId: 'version-3',
      triggers: [{
        type: 'signal_published',
        config: {
          name: 'BTC signals',
          filter: { symbol: 'BTCUSDT' },
        },
      }],
    });
  });

  it('omits an empty filter', () => {
    expect(buildTriggerRegistrationPayload('version-3', {
      type: 'risk_event',
      name: 'Risk events',
      filter: '',
    })).toEqual({
      versionId: 'version-3',
      triggers: [{
        type: 'risk_event',
        config: { name: 'Risk events' },
      }],
    });
  });
});

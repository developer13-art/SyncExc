import { describe, expect, test } from 'vitest';
import { apiConfig } from './api.config.js';

describe('marketplace API endpoints', () => {
  test('uses the mounted marketplace routes for copy configuration operations', () => {
    expect(apiConfig.endpoints.marketplace.copyConfigurations).toBe('/marketplace/copy-configurations');
    expect(apiConfig.endpoints.marketplace.copyConfiguration('config-id'))
      .toBe('/marketplace/copy-configurations/config-id');
    expect(apiConfig.endpoints.marketplace.activateCopyConfig('config-id'))
      .toBe('/marketplace/copy-configurations/config-id/activate');
  });

  test('uses the mounted copy results route', () => {
    expect(apiConfig.endpoints.marketplace.copySignalResults).toBe('/marketplace/copy-results');
  });
});

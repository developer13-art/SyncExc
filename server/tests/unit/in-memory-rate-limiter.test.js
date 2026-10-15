import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createInMemoryRateLimiter } from '../../src/lib/in-memory-rate-limiter.js';

describe('in-memory rate limiter', () => {
  it('counts requests independently by key and window', () => {
    const limiter = createInMemoryRateLimiter();

    assert.equal(limiter.incrementWithTtl('login:user-a', 60), 1);
    assert.equal(limiter.incrementWithTtl('login:user-a', 60), 2);
    assert.equal(limiter.incrementWithTtl('login:user-b', 60), 1);
  });

  it('supports weighted increments and expires counters', () => {
    const limiter = createInMemoryRateLimiter();

    assert.equal(limiter.incrementWithTtl('exchange:binance', 60, 5), 5);
    assert.equal(limiter.incrementWithTtl('expired', 0), 1);
    assert.equal(limiter.incrementWithTtl('expired', 60), 1);
  });

  it('fails explicitly when its bounded key capacity is exhausted', () => {
    const limiter = createInMemoryRateLimiter({ maxKeys: 1 });
    limiter.incrementWithTtl('one', 60);

    assert.throws(
      () => limiter.incrementWithTtl('two', 60),
      /capacity exceeded/,
    );
  });
});

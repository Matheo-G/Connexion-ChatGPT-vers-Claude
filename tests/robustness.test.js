/**
 * Unit tests for step 6: retry policy, patience-scaled timeouts, keep-alive.
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RouterError, ErrorCode } from '../src/shared/errors.js';
import { Timeouts, scaleTimeouts } from '../src/shared/defaults.js';
import { isSafeToRetry } from '../src/background/delivery.js';
import { withKeepAlive } from '../src/background/keepalive.js';

const err = (code) => new RouterError(code);

test('retry: any non-permanent failure before submitting is retried', () => {
  assert.ok(isSafeToRetry(err(ErrorCode.TIMEOUT), 'prepare'));
  assert.ok(isSafeToRetry(err(ErrorCode.TARGET_UNAVAILABLE), 'prepare'));
  assert.ok(isSafeToRetry(err(ErrorCode.MESSAGING_FAILED), 'prepare'));
});

test('retry: after submitting, only when nothing can have been sent', () => {
  assert.ok(isSafeToRetry(err(ErrorCode.EDITOR_NOT_FOUND), 'submit'));
  assert.ok(isSafeToRetry(err(ErrorCode.INSERT_FAILED), 'submit'));
  // The message may already be in Claude: never risk a duplicate.
  assert.ok(!isSafeToRetry(err(ErrorCode.TIMEOUT), 'submit'));
  assert.ok(!isSafeToRetry(err(ErrorCode.MESSAGING_FAILED), 'submit'));
  assert.ok(!isSafeToRetry(err(ErrorCode.SEND_FAILED), 'submit'));
});

test('retry: permanent problems are never retried', () => {
  for (const code of [ErrorCode.TARGET_NOT_LOGGED_IN, ErrorCode.TARGET_RATE_LIMITED, ErrorCode.NO_CONTENT]) {
    assert.ok(!isSafeToRetry(err(code), 'prepare'), code);
    assert.ok(!isSafeToRetry(err(code), 'submit'), code);
  }
});

test('patience scales every timeout', () => {
  assert.deepEqual(scaleTimeouts('normal'), Timeouts);
  const patient = scaleTimeouts('patient');
  for (const [key, ms] of Object.entries(Timeouts)) assert.equal(patient[key], ms * 2, key);
  assert.deepEqual(scaleTimeouts('unknown'), Timeouts);
});

test('keep-alive pings while the task runs, then stops', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  const ping = mock.fn(() => Promise.resolve({}));
  globalThis.chrome = { runtime: { getPlatformInfo: ping } };

  let finish;
  const running = withKeepAlive(() => new Promise((resolve) => (finish = resolve)), { interval: 1000 });
  mock.timers.tick(3000);
  assert.equal(ping.mock.callCount(), 3);

  finish('done');
  assert.equal(await running, 'done');
  mock.timers.tick(5000);
  assert.equal(ping.mock.callCount(), 3, 'no ping after the task');
  mock.timers.reset();
});

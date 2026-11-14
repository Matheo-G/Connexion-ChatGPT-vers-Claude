/**
 * Unit tests for step 1 pure modules: async helpers, URL matching,
 * provider registry and the message handler (with a fake chrome object).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { withTimeout, poll, retry, sleep } from '../src/utils/async.js';
import { urlMatchesAny, isSamePage } from '../src/utils/url.js';
import { getProvider, findProviderByUrl, listProviders } from '../src/providers/registry.js';
import { createMessageHandler } from '../src/services/messaging.js';
import { MessageType } from '../src/shared/message-types.js';
import { RouterError, ErrorCode } from '../src/shared/errors.js';

describe('async', () => {
  test('withTimeout resolves fast promises and rejects slow ones with TIMEOUT', async () => {
    assert.equal(await withTimeout(Promise.resolve(42), 50), 42);
    await assert.rejects(withTimeout(sleep(100), 10), { code: ErrorCode.TIMEOUT });
  });

  test('poll returns the first truthy value and treats throws as "not yet"', async () => {
    let calls = 0;
    const value = await poll(
      () => {
        calls += 1;
        if (calls < 3) throw new Error('not ready');
        return 'ok';
      },
      { interval: 1, timeout: 500 },
    );
    assert.equal(value, 'ok');
    assert.equal(calls, 3);
  });

  test('poll rejects with the requested code', async () => {
    await assert.rejects(poll(() => false, { interval: 1, timeout: 20, code: ErrorCode.TARGET_UNAVAILABLE }), {
      code: ErrorCode.TARGET_UNAVAILABLE,
    });
  });

  test('retry retries then gives up with a RouterError', async () => {
    let attempts = 0;
    await assert.rejects(
      retry(
        () => {
          attempts += 1;
          throw new RouterError(ErrorCode.SEND_FAILED);
        },
        { attempts: 3, delay: 1 },
      ),
      { code: ErrorCode.SEND_FAILED },
    );
    assert.equal(attempts, 3);
  });

  test('retry stops early when shouldRetry says no', async () => {
    let attempts = 0;
    await assert.rejects(
      retry(
        () => {
          attempts += 1;
          throw new Error('fatal');
        },
        { attempts: 5, delay: 1, shouldRetry: () => false },
      ),
    );
    assert.equal(attempts, 1);
  });
});

describe('url', () => {
  test('urlMatchesAny follows Chrome match pattern semantics', () => {
    assert.ok(urlMatchesAny('https://claude.ai/new', ['https://claude.ai/*']));
    assert.ok(urlMatchesAny('https://claude.ai/', ['https://claude.ai/*']));
    assert.ok(!urlMatchesAny('https://claude.ai.evil.com/', ['https://claude.ai/*']));
    assert.ok(!urlMatchesAny('http://claude.ai/new', ['https://claude.ai/*']));
    assert.ok(!urlMatchesAny(undefined, ['https://claude.ai/*']));
  });

  test('isSamePage ignores query, hash and trailing slash', () => {
    assert.ok(isSamePage('https://claude.ai/new?x=1#y', 'https://claude.ai/new'));
    assert.ok(isSamePage('https://claude.ai/new/', 'https://claude.ai/new'));
    assert.ok(!isSamePage('https://claude.ai/chat/abc', 'https://claude.ai/new'));
    assert.ok(!isSamePage('not a url', 'https://claude.ai/new'));
  });
});

describe('provider registry', () => {
  test('finds providers by URL', () => {
    assert.equal(findProviderByUrl('https://chatgpt.com/c/123').id, 'chatgpt');
    assert.equal(findProviderByUrl('https://chat.openai.com/').id, 'chatgpt');
    assert.equal(findProviderByUrl('https://claude.ai/chat/1').id, 'claude');
    assert.equal(findProviderByUrl('https://example.com/'), null);
  });

  test('getProvider enforces the requested role', () => {
    assert.equal(getProvider('claude', 'target').id, 'claude');
    assert.throws(() => getProvider('chatgpt', 'target'), { code: ErrorCode.PROVIDER_NOT_FOUND });
    assert.throws(() => getProvider('nope'), { code: ErrorCode.PROVIDER_NOT_FOUND });
  });

  test('every provider is complete and its new-chat URL matches its patterns', () => {
    for (const p of listProviders()) {
      for (const key of ['id', 'name', 'matches', 'newChatUrl', 'roles', 'adapterPath']) {
        assert.ok(p[key], `${p.id} is missing ${key}`);
      }
      assert.ok(urlMatchesAny(p.newChatUrl, p.matches), `${p.id} newChatUrl outside matches`);
    }
  });
});

describe('createMessageHandler', () => {
  globalThis.chrome = { runtime: { id: 'self' } };
  const self = { id: 'self' };

  const call = (handler, message, sender = self) =>
    new Promise((resolve) => {
      const keepOpen = handler(message, sender, resolve);
      if (!keepOpen) resolve('ignored');
    });

  test('returns handler data as {ok: true, data}', async () => {
    const handler = createMessageHandler({ [MessageType.PING]: async (p) => ({ echo: p.x }) });
    assert.deepEqual(await call(handler, { type: MessageType.PING, payload: { x: 1 } }), {
      ok: true,
      data: { echo: 1 },
    });
  });

  test('serializes thrown errors', async () => {
    const handler = createMessageHandler({
      [MessageType.PING]: () => {
        throw new RouterError(ErrorCode.EDITOR_NOT_FOUND, 'gone');
      },
    });
    const response = await call(handler, { type: MessageType.PING });
    assert.equal(response.ok, false);
    assert.equal(RouterError.from(response.error).code, ErrorCode.EDITOR_NOT_FOUND);
  });

  test('ignores foreign senders, unknown and unhandled types', async () => {
    const handler = createMessageHandler({ [MessageType.PING]: () => 'pong' });
    assert.equal(await call(handler, { type: MessageType.PING }, { id: 'other-extension' }), 'ignored');
    assert.equal(await call(handler, { type: 'evil' }), 'ignored');
    assert.equal(await call(handler, { type: MessageType.GET_STATUS }), 'ignored');
  });
});

/**
 * Unit tests for the step-0 foundations (pure modules, no browser needed).
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RouterError, ErrorCode } from '../src/shared/errors.js';
import { MessageType, isValidMessage } from '../src/shared/message-types.js';
import { DEFAULT_SETTINGS } from '../src/shared/defaults.js';
import { createLogger, setDebug } from '../src/utils/logger.js';
import { icon, iconNames } from '../src/ui-kit/icons.js';
import { readFile } from 'node:fs/promises';

test('RouterError survives a JSON round-trip (messaging boundary)', () => {
  const original = new RouterError(ErrorCode.EDITOR_NOT_FOUND, 'no editor', { tried: 3 });
  const wire = JSON.parse(JSON.stringify(original));
  const rebuilt = RouterError.from(wire);

  assert.ok(rebuilt instanceof RouterError);
  assert.equal(rebuilt.code, ErrorCode.EDITOR_NOT_FOUND);
  assert.equal(rebuilt.message, 'no editor');
  assert.deepEqual(rebuilt.details, { tried: 3 });
});

test('RouterError.from normalizes foreign errors and unknown codes', () => {
  const fromNative = RouterError.from(new TypeError('boom'), ErrorCode.TIMEOUT);
  assert.equal(fromNative.code, ErrorCode.TIMEOUT);
  assert.equal(fromNative.message, 'boom');

  assert.equal(new RouterError('NOT_A_CODE').code, ErrorCode.UNKNOWN);
  assert.equal(RouterError.from('plain string').message, 'plain string');
});

test('every error code has a French user message', async () => {
  const messages = JSON.parse(await readFile(new URL('../_locales/fr/messages.json', import.meta.url)));
  for (const code of Object.values(ErrorCode)) {
    assert.ok(messages[`error_${code}`]?.message, `missing error_${code}`);
  }
});

test('isValidMessage accepts known types only', () => {
  assert.ok(isValidMessage({ type: MessageType.PING }));
  assert.ok(!isValidMessage({ type: 'evil/unknown' }));
  assert.ok(!isValidMessage(null));
  assert.ok(!isValidMessage('core/ping'));
});

test('message type values are unique', () => {
  const values = Object.values(MessageType);
  assert.equal(new Set(values).size, values.length);
});

test('default settings match the validated design choices', () => {
  assert.equal(DEFAULT_SETTINGS.defaultTarget, 'claude');
  assert.equal(DEFAULT_SETTINGS.newConversation, true);
  assert.equal(DEFAULT_SETTINGS.autoSend, true);
  assert.equal(DEFAULT_SETTINGS.returnToSource, false);
  assert.ok(Object.isFrozen(DEFAULT_SETTINGS));
});

test('logger prints debug only when debug mode is on', (t) => {
  const calls = [];
  t.mock.method(console, 'debug', (...args) => calls.push(args));
  const log = createLogger('test');

  setDebug(false);
  log.debug('hidden');
  assert.equal(calls.length, 0);

  setDebug(true);
  log.debug('shown');
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /AI Router · test/);
  setDebug(false);
});

test('icons render valid, theme-aware SVG', () => {
  for (const name of iconNames()) {
    const svg = icon(name);
    assert.match(svg, /^<svg[^>]+stroke="currentColor"/);
    assert.match(svg, /aria-hidden="true"/);
  }
  assert.match(icon('send', { label: 'Envoyer "x"' }), /aria-label="Envoyer &#34;x&#34;"/);
});

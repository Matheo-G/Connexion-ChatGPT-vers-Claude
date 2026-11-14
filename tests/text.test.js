/**
 * Unit tests for utils/text.js (used to verify insertions in target editors).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, hasText, fingerprint } from '../src/utils/text.js';

test('normalizeText collapses every kind of whitespace', () => {
  assert.equal(normalizeText('  a\n\n b\t c  '), 'a b c');
  assert.equal(normalizeText(null), '');
});

test('hasText ignores whitespace-only input', () => {
  assert.ok(hasText(' x '));
  assert.ok(!hasText(' \n\t '));
  assert.ok(!hasText(undefined));
});

test('fingerprint ignores Markdown markup rendered by rich editors', () => {
  const raw = '# Titre\n- **gras** et `code`';
  const rendered = 'Titre\ngras et code';
  assert.equal(fingerprint(raw), fingerprint(rendered));
});

test('fingerprint is a bounded prefix', () => {
  assert.equal(fingerprint('a'.repeat(100)).length, 40);
  assert.equal(fingerprint('a'.repeat(100), 10).length, 10);
  assert.ok(fingerprint('a '.repeat(200), Infinity).length > 300);
});

/**
 * Unit tests for settings sanitising, history entries and relative dates.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSettings } from '../src/services/settings.js';
import { createEntry, prepend } from '../src/services/history.js';
import { formatRelative } from '../src/utils/time.js';
import { DEFAULT_SETTINGS, HISTORY_LIMIT, HISTORY_PREVIEW_LENGTH } from '../src/shared/defaults.js';

test('sanitizeSettings keeps valid values and drops the rest', () => {
  const clean = sanitizeSettings({
    autoSend: false,
    theme: 'dark',
    newConversation: 'yes', // wrong type
    unknownKey: 1, // unknown
  });
  assert.equal(clean.autoSend, false);
  assert.equal(clean.theme, 'dark');
  assert.equal(clean.newConversation, DEFAULT_SETTINGS.newConversation);
  assert.ok(!('unknownKey' in clean));
});

test('sanitizeSettings rejects values outside an enumeration', () => {
  assert.equal(sanitizeSettings({ theme: 'purple' }).theme, 'auto');
});

test('sanitizeSettings survives garbage', () => {
  for (const raw of [undefined, null, 'x', 42, []]) {
    assert.deepEqual(sanitizeSettings(raw), { ...DEFAULT_SETTINGS });
  }
});

test('history entries keep only a short, flattened preview', () => {
  const text = `# Titre\n\n${'mot '.repeat(100)}`;
  const entry = createEntry({ id: '1', at: 0, status: 'sent', sourceId: 'chatgpt', targetId: 'claude', workflowId: 'default', text });
  assert.equal(entry.length, text.length);
  assert.equal(entry.preview.length, HISTORY_PREVIEW_LENGTH);
  assert.ok(entry.preview.startsWith('# Titre mot mot'));
  assert.ok(entry.preview.endsWith('…'));
  assert.ok(!('text' in entry));
});

test('history is newest first and capped', () => {
  let history = [];
  for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) history = prepend(history, { id: String(i) });
  assert.equal(history.length, HISTORY_LIMIT);
  assert.equal(history[0].id, String(HISTORY_LIMIT + 4));
});

test('formatRelative speaks French', () => {
  const now = Date.UTC(2026, 10, 16, 12);
  assert.equal(formatRelative(now - 10_000, { now }), 'maintenant');
  assert.equal(formatRelative(now - 3 * 60_000, { now }), 'il y a 3 minutes');
  assert.equal(formatRelative(now - 2 * 3600_000, { now }), 'il y a 2 heures');
  assert.equal(formatRelative(now - 26 * 3600_000, { now }), 'hier');
});

// ---- Code review regressions (step 8) ---------------------------------------

import { Timeouts, scaleTimeouts } from '../src/shared/defaults.js';

test('sanitizeSettings rejects unknown or source-only ids', () => {
  assert.equal(sanitizeSettings({ defaultTarget: 'chatgpt' }).defaultTarget, 'claude', 'source-only AI');
  assert.equal(sanitizeSettings({ defaultTarget: 'gemini' }).defaultTarget, 'claude', 'unknown AI');
  assert.equal(sanitizeSettings({ defaultWorkflow: 'linkedin' }).defaultWorkflow, 'default', 'removed workflow');
  assert.equal(sanitizeSettings({ defaultWorkflow: 'figma' }).defaultWorkflow, 'figma');
});

test('UIs wait longer than the slowest possible delivery (patient × automatic retry)', () => {
  const t = scaleTimeouts('patient');
  const worstDelivery = 2 * (t.TAB_LOAD + t.CONTENT_READY + t.SUBMIT);
  assert.ok(Timeouts.CALLER > worstDelivery + Timeouts.MESSAGE, `${Timeouts.CALLER} <= ${worstDelivery}`);
});

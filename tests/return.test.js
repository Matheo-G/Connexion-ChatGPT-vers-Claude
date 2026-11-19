/**
 * Step 9 — way back to ChatGPT: return text and conversation links (pure parts).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeReturn } from '../src/workflows/return-kit.js';
import { matchLink } from '../src/background/conversation-links.js';
import { getProvider } from '../src/providers/registry.js';

test('composeReturn: header names the AI and the brief command', () => {
  assert.equal(composeReturn({ sourceName: 'Claude', markdown: '  Fait.\n' }), '↩ Retour de Claude\n\nFait.');
  assert.equal(
    composeReturn({ sourceName: 'Claude', markdown: '## Résultat', command: '/figma' }),
    '↩ Retour de Claude · /figma\n\n## Résultat',
  );
});

const NEW = 'https://claude.ai/new';
const link = (fields) => ({ targetId: 'claude', targetTabId: 1, targetUrl: NEW, sourceUrl: 'https://chatgpt.com/c/a', sourceTabId: 9, workflowId: 'default', at: 0, ...fields });

test('matchLink: same Claude conversation first', () => {
  const links = [link({ targetUrl: 'https://claude.ai/chat/x', sourceUrl: 'https://chatgpt.com/c/x' }), link({ targetUrl: 'https://claude.ai/chat/y', sourceUrl: 'https://chatgpt.com/c/y' })];
  const found = matchLink(links, { targetId: 'claude', tabId: 5, url: 'https://claude.ai/chat/y?x=1', newChatUrl: NEW });
  assert.equal(found.sourceUrl, 'https://chatgpt.com/c/y');
});

test('matchLink: a brief left on "new chat" in this tab (address given afterwards)', () => {
  const links = [link({ targetTabId: 2, sourceUrl: 'https://chatgpt.com/c/other-tab' }), link({ targetTabId: 1, sourceUrl: 'https://chatgpt.com/c/mine' })];
  const found = matchLink(links, { targetId: 'claude', tabId: 1, url: 'https://claude.ai/chat/z', newChatUrl: NEW });
  assert.equal(found.sourceUrl, 'https://chatgpt.com/c/mine');
});

test('matchLink: nothing known → null (latest ChatGPT tab is used)', () => {
  const links = [link({ targetTabId: 1, targetUrl: 'https://claude.ai/chat/old' }), link({ targetId: 'copilot', targetTabId: 3 })];
  assert.equal(matchLink(links, { targetId: 'claude', tabId: 3, url: 'https://claude.ai/chat/z', newChatUrl: NEW }), null);
  assert.equal(matchLink(links, { targetId: 'claude', tabId: 1, url: 'https://claude.ai/chat/z', newChatUrl: NEW }), null);
});

test('registry: Claude goes back to ChatGPT, which receives without being a destination', () => {
  const claude = getProvider('claude');
  const chatgpt = getProvider(claude.returnTo);
  assert.equal(chatgpt.id, 'chatgpt');
  assert.equal(chatgpt.receivesReturns, true);
  assert.ok(!chatgpt.roles.includes('target'), 'not offered in "Envoyer vers"');
});

/**
 * Step 1 — messaging, tab management, injection, handshake.
 * Run: npm run test:e2e
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');

let h;

const OPEN = (payload) => h.sendMessage({ type: 'ui/open-target', payload });
const claudeTabs = () => h.evalSW(() => chrome.tabs.query({ url: 'https://claude.ai/*' }));

before(async () => {
  h = await launch();
});

after(async () => {
  await h?.close();
});

beforeEach(async () => {
  Object.assign(h.control, { hang: null, fixture: {}, loggedOut: false });
  for (const page of h.pagesOf('claude.ai')) await page.close();
});

test('content runtime boots on ChatGPT and answers PING', async () => {
  const page = await h.context.newPage();
  await page.goto('https://chatgpt.com/c/123');
  const tabId = await h.evalSW(async () => (await chrome.tabs.query({ url: 'https://chatgpt.com/*' }))[0].id);
  const answer = await h.evalSW((id) => aiRouter.ensureContentScript(id), tabId);
  assert.equal(answer.providerId, 'chatgpt');
  assert.equal(answer.path, '/c/123');
  await page.close();
});

test('no Claude tab → opens claude.ai/new and gets a handshake', async () => {
  const res = await OPEN({ providerId: 'claude', activate: false });
  assert.equal(res.ok, true, JSON.stringify(res.error));
  assert.equal(res.data.mode, 'created');
  assert.equal(res.data.page.providerId, 'claude');
  assert.equal(res.data.page.path, '/new');
  assert.equal((await claudeTabs()).length, 1);
});

test('Claude tab already on /new → reused, no extra tab', async () => {
  await OPEN({ providerId: 'claude', activate: false });
  const res = await OPEN({ providerId: 'claude', activate: true });
  assert.equal(res.data.mode, 'reused');
  const tabs = await claudeTabs();
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0].active, true, 'tab should be focused');
});

test('Claude tab on a conversation + newConversation → navigated to /new', async () => {
  const page = await h.context.newPage();
  await page.goto('https://claude.ai/chat/abc');
  const res = await OPEN({ providerId: 'claude', activate: false, newConversation: true });
  assert.equal(res.data.mode, 'navigated');
  assert.equal(res.data.page.path, '/new', 'handshake must come from the NEW page');
  assert.equal((await claudeTabs()).length, 1);
});

test('newConversation=false → existing conversation is kept', async () => {
  const page = await h.context.newPage();
  await page.goto('https://claude.ai/chat/abc');
  const res = await OPEN({ providerId: 'claude', activate: false, newConversation: false });
  assert.equal(res.data.mode, 'reused');
  assert.equal(res.data.page.path, '/chat/abc');
});

test('injecting the loader twice does not boot the runtime twice', async () => {
  const page = await h.context.newPage();
  const readyLogs = [];
  page.on('console', (m) => m.text().includes('Ready on Claude') && readyLogs.push(m.text()));
  await page.goto('https://claude.ai/new');
  const { tabId } = (await OPEN({ providerId: 'claude', activate: false })).data;

  await h.evalSW(
    (id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ['src/content/loader.js'] }),
    tabId,
  );
  await page.waitForTimeout(500);
  assert.equal(readyLogs.length, 1);
  assert.ok(await h.evalSW((id) => aiRouter.pingTab(id), tabId));
});

test('tab without a live content script (opened before install) → re-injected', async () => {
  const page = await h.context.newPage();
  await page.goto('https://claude.ai/new');
  const { tabId } = (await OPEN({ providerId: 'claude', activate: false })).data;

  // Kill the running instance from the page, as an extension reload would.
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('ai-router:teardown')));
  assert.equal(await h.evalSW((id) => aiRouter.pingTab(id), tabId), null, 'instance should be dead');

  const res = await OPEN({ providerId: 'claude', activate: false });
  assert.equal(res.ok, true, JSON.stringify(res.error));
  assert.equal(res.data.tabId, tabId);
  assert.equal(res.data.page.providerId, 'claude');
});

test('tab closed while loading → TARGET_UNAVAILABLE', async () => {
  h.control.hang = /claude\.ai\/new/;
  const pending = OPEN({ providerId: 'claude', activate: false });
  // The tab never finishes loading: find and close it through the Chrome API.
  const tabId = await h.evalSW(async () => {
    for (;;) {
      const [tab] = await chrome.tabs.query({ url: 'https://claude.ai/*' });
      if (tab) return tab.id;
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  await h.evalSW((id) => chrome.tabs.remove(id), tabId);
  const res = await pending;
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'TARGET_UNAVAILABLE');
});

test('unknown provider → PROVIDER_NOT_FOUND', async () => {
  const res = await OPEN({ providerId: 'gemini' });
  assert.equal(res.error.code, 'PROVIDER_NOT_FOUND');
});

test('GET_STATUS reports each provider', async () => {
  await OPEN({ providerId: 'claude', activate: false });
  const res = await h.sendMessage({ type: 'ui/get-status' });
  const claude = res.data.find((p) => p.id === 'claude');
  const chatgpt = res.data.find((p) => p.id === 'chatgpt');
  assert.equal(claude.state, 'ready');
  assert.equal(claude.tabCount, 1);
  assert.equal(chatgpt.state, 'no-tab');
});

test('popup: status list + "test connection" button', async () => {
  const popup = await h.openPopup({ tools: true });
  await popup.locator('.provider[data-state="no-tab"]', { hasText: 'Claude' }).waitFor();

  await popup.click('#test-target');
  await popup.locator('#tools-feedback[data-tone="success"]').waitFor({ timeout: 15_000 });
  assert.match(await popup.textContent('#tools-feedback'), /Claude est prêt \(\d+,\d s\)/);
  await popup.locator('.provider[data-state="ready"]', { hasText: 'Claude' }).waitFor();
  await popup.close();
});

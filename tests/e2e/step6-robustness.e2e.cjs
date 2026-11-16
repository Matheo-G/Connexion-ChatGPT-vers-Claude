/**
 * Step 6 — robustness: safe automatic retry, patience setting, page
 * recognition health, Claude diagnostic.
 * Run: npm run test:e2e
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');

let h;

before(async () => {
  h = await launch();
});

after(async () => {
  await h?.close();
});

beforeEach(async () => {
  Object.assign(h.control, { hang: null, fixture: {}, chatgpt: {}, loggedOut: false, fixtureQueue: [] });
  h.control.claudeLoads.length = 0;
  await h.evalSW(() => chrome.storage.sync.clear());
  for (const page of [...h.pagesOf('chatgpt.com'), ...h.pagesOf('claude.ai')]) await page.close();
});

const deliver = (text, options = {}) =>
  h.sendMessage({ type: 'pipeline/deliver-text', payload: { providerId: 'claude', text, ...options } });

/** Provider status once the page's script has booted (not-ready = still starting). */
async function status(id) {
  for (let i = 0; i < 40; i += 1) {
    const state = (await h.sendMessage({ type: 'ui/get-status' })).data.find((p) => p.id === id);
    if (state.state !== 'not-ready') return state;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${id} never became reachable`);
}

test('editor never appeared → one automatic retry on a fresh page, sent once', async () => {
  h.control.fixtureQueue = [{ noEditor: true }]; // first load broken, second fine
  const res = await deliver('Message après récupération');
  assert.equal(res.ok, true, JSON.stringify(res.error));
  assert.equal(res.data.retried, true);
  assert.equal(h.control.claudeLoads.length, 2);
  assert.deepEqual(await h.pagesOf('claude.ai')[0].evaluate(() => window.__sent), ['Message après récupération']);
});

test('logged out → no retry (it cannot help)', async () => {
  h.control.loggedOut = true;
  const res = await deliver('Bonjour');
  assert.equal(res.error.code, 'TARGET_NOT_LOGGED_IN');
  assert.equal(h.control.claudeLoads.filter((p) => p === '/new').length, 1, 'a single attempt');
});

test('usage limit → no retry (the message must not be sent twice)', async () => {
  h.control.fixture = { rateLimited: true };
  const res = await deliver('Bonjour');
  assert.equal(res.error.code, 'TARGET_RATE_LIMITED');
  assert.equal(h.control.claudeLoads.length, 1);
});

test('"slow connection" patience waits twice as long for Claude', async () => {
  await h.evalSW(() => chrome.storage.sync.set({ settings: { patience: 'patient' } }));
  h.control.chatgpt = { layout: 'turn-key' };
  h.control.fixture = { mountDelay: 17_000 }; // beyond the normal 15 s wait
  const chatgpt = await h.context.newPage();
  await chatgpt.goto('https://chatgpt.com/c/demo');

  const res = await h.sendMessage({ type: 'pipeline/route-request', payload: { trigger: 'api' } });
  assert.equal(res.ok, true, JSON.stringify(res.error));
  assert.equal(res.data.retried, false);
  assert.equal(h.control.claudeLoads.length, 1);
});

test('health: an unknown ChatGPT layout is reported in the popup', async () => {
  h.control.chatgpt = { layout: 'unknown' };
  const page = await h.context.newPage();
  await page.goto('https://chatgpt.com/c/demo');
  assert.equal((await status('chatgpt')).state, 'unrecognized');

  const popup = await h.openPopup();
  await popup.locator('.provider[data-state="unrecognized"]', { hasText: 'ChatGPT' }).waitFor();
  assert.match(await popup.textContent('#status-hint'), /ChatGPT a peut-être changé sa page/);
});

test('health: Claude without editor is "unrecognized", but not on its settings page', async () => {
  h.control.fixture = { noEditor: true };
  const page = await h.context.newPage();
  await page.goto('https://claude.ai/new');
  await page.waitForLoadState('load');
  assert.equal((await status('claude')).state, 'unrecognized');

  await page.goto('https://claude.ai/settings');
  await page.waitForLoadState('load');
  assert.equal((await status('claude')).state, 'ready');
});

test('Claude diagnostic: structure only, never the text', async () => {
  h.control.fixture = { draft: 'brouillon très secret' };
  const page = await h.context.newPage();
  await page.goto('https://claude.ai/new');
  await page.locator('.ProseMirror').waitFor();

  const res = await h.sendMessage({ type: 'ui/diagnose', payload: { providerId: 'claude' } });
  assert.match(res.data.text, /diagnostic Claude/);
  assert.match(res.data.text, /Connecté : true — éditeur : true — bouton d'envoi : true/);
  assert.match(res.data.text, /\[aria-label="Envoyer le message"\]/);
  assert.ok(!res.data.text.includes('secret'), 'no conversation text');
});

test('install/update: open tabs get a working script again, without duplicates', async () => {
  h.control.chatgpt = { layout: 'turn-key' };
  const page = await h.context.newPage();
  await page.goto('https://chatgpt.com/c/demo');
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-router-button]').length === 2);

  // What an extension update does to a page: its script dies (here: told to tear down).
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('ai-router:teardown')));
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-router-button]').length === 0);

  // What the service worker does on install/update.
  assert.ok((await h.evalSW(() => aiRouter.injectIntoOpenTabs())) >= 1);
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-router-button]').length === 2);

  // Injecting into a healthy page again must not duplicate anything.
  await h.evalSW(() => aiRouter.injectIntoOpenTabs());
  await page.waitForTimeout(800);
  assert.equal(await page.locator('[data-ai-router-button]').count(), 2);

  await page.locator('[data-ai-router-button] .main').last().click();
  await page.waitForFunction(() => document.querySelectorAll('[data-ai-router-button]')[1]?.dataset.state === 'success', null, {
    timeout: 30_000,
  });
});

test('options: patience can be chosen', async () => {
  const options = await h.context.newPage();
  await options.goto(`chrome-extension://${h.extensionId}/src/options/options.html`);
  await options.locator('body[data-ready="true"]').waitFor();
  await options.click('label[for="setting-patience-patient"]');
  await options.locator('#saved[data-visible="true"]').waitFor();
  assert.equal(await h.evalSW(async () => (await chrome.storage.sync.get('settings')).settings.patience), 'patient');
  await options.close();
});

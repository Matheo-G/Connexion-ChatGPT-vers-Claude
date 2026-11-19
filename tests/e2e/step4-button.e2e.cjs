/**
 * Step 4 — V1: "Send to Claude" button under ChatGPT answers, pipeline,
 * progress, errors, settings and keyboard shortcut.
 * Run: npm run test:e2e
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');
const { EXPECTED, nonEmptyLines } = require('./expected.cjs');

let h;

const BUTTON = '[data-ai-router-button]';

before(async () => {
  h = await launch();
});

after(async () => {
  await h?.close();
});

beforeEach(async () => {
  Object.assign(h.control, { hang: null, fixture: {}, chatgpt: {}, loggedOut: false });
  await setSettings({});
  for (const page of [...h.pagesOf('chatgpt.com'), ...h.pagesOf('claude.ai')]) await page.close();
});

/**
 * The fixture prompt starts with "/figma": slash detection is turned off here
 * so the exact answer can be compared (step 7 tests the detection itself).
 */
function setSettings(settings) {
  return h.evalSW((s) => chrome.storage.sync.set({ settings: s }), { detectSlashCommands: false, ...settings });
}

async function openChatGPT(scenario = { layout: 'turn-key' }) {
  h.control.chatgpt = scenario;
  const page = await h.context.newPage();
  await page.goto('https://chatgpt.com/c/demo');
  await page.locator(BUTTON).first().waitFor();
  return page;
}

/** Clicks the send button of the n-th answer (default: last). */
async function clickSend(page, index = -1) {
  const buttons = page.locator(`${BUTTON} .main`);
  const n = index < 0 ? (await buttons.count()) + index : index;
  await buttons.nth(n).click();
}

async function claudeMessages() {
  const page = await waitForClaudePage();
  await page.waitForFunction(() => window.__sent?.length > 0, null, { timeout: 20_000 });
  return page.evaluate(() => window.__sent);
}

async function waitForClaudePage() {
  for (let i = 0; i < 100; i += 1) {
    const page = h.pagesOf('claude.ai')[0];
    if (page) return page;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('No Claude tab');
}

const buttonState = (page, index = -1) =>
  page.locator(BUTTON).nth(index < 0 ? 1 : index).getAttribute('data-state');

const activeTabUrl = () =>
  h.evalSW(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.url);

test('one button per answer in both layouts, following the page theme', async () => {
  const page = await openChatGPT({ layout: 'turn-key' });
  await page.waitForTimeout(300);
  assert.equal(await page.locator(BUTTON).count(), 2, 'turn-key: one per answer, none in the hidden cached page');

  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.theme === 'dark', BUTTON);

  const classic = await openChatGPT({});
  assert.equal(await classic.locator(BUTTON).count(), 2, 'classic layout');
});

test('no button on an answer still being written', async () => {
  const page = await openChatGPT({ layout: 'turn-key', streaming: true });
  await page.waitForTimeout(400);
  assert.equal(await page.locator(BUTTON).count(), 1);
});

test('click → the answer lands in Claude, sent; button turns to success', async () => {
  const page = await openChatGPT();
  await clickSend(page);
  const [sent] = await claudeMessages();
  assert.deepEqual(nonEmptyLines(sent), nonEmptyLines(EXPECTED));
  await page.waitForFunction((sel) => document.querySelectorAll(sel)[1]?.dataset.state === 'success', BUTTON);
  assert.match(await activeTabUrl(), /claude\.ai/, 'Claude is in front');
});

test('the button of an older answer sends that answer', async () => {
  const page = await openChatGPT();
  await clickSend(page, 0);
  assert.deepEqual(await claudeMessages(), ['Première réponse.']);
});

test('buttons survive React re-renders and virtualisation, without duplicates', async () => {
  const page = await openChatGPT();
  await page.evaluate((sel) => document.querySelectorAll(sel).forEach((b) => b.remove()), BUTTON);
  await page.waitForFunction((sel) => document.querySelectorAll(sel).length === 2, BUTTON);

  await page.evaluate(() => {
    const item = document.querySelectorAll('[data-turn-key="u2"]')[0];
    const parent = item.parentElement;
    item.remove();
    setTimeout(() => parent.append(item), 300); // unmounted then mounted again
  });
  await page.waitForTimeout(900);
  assert.equal(await page.locator(BUTTON).count(), 2);
});

test('failure → error state + toast with a working "retry"', async () => {
  h.control.loggedOut = true;
  const page = await openChatGPT();
  await clickSend(page);

  const toast = page.locator('[data-ai-router-toasts] .toast[data-tone="error"]');
  await toast.waitFor({ timeout: 20_000 });
  assert.match(await toast.textContent(), /pas connecté/);
  assert.equal(await buttonState(page), 'error');

  h.control.loggedOut = false;
  await page.bringToFront();
  await toast.locator('.action').click();
  assert.equal((await claudeMessages()).length, 1);
});

test('double click sends only once', async () => {
  const page = await openChatGPT();
  const main = page.locator(`${BUTTON} .main`).last();
  await main.click();
  await main.click({ force: true });
  await claudeMessages();
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal((await h.pagesOf('claude.ai')[0].evaluate(() => window.__sent)).length, 1);
});

test('setting "return to ChatGPT" brings the source tab back', async () => {
  await setSettings({ returnToSource: true });
  const page = await openChatGPT();
  await clickSend(page);
  await claudeMessages();
  await page.waitForFunction((sel) => document.querySelectorAll(sel)[1]?.dataset.state === 'success', BUTTON);
  assert.match(await activeTabUrl(), /chatgpt\.com/);
});

test('setting "auto send" off → inserted in Claude, not sent', async () => {
  await setSettings({ autoSend: false });
  const page = await openChatGPT();
  await clickSend(page);
  await page.waitForFunction((sel) => document.querySelectorAll(sel)[1]?.dataset.state === 'success', BUTTON);
  assert.equal(await page.locator(`${BUTTON} .label`).nth(1).textContent(), 'Inséré');

  const claude = h.pagesOf('claude.ai')[0];
  assert.deepEqual(await claude.evaluate(() => window.__sent), []);
  assert.match(await claude.locator('.ProseMirror').innerText(), /Écran de connexion/);
});

test('keyboard shortcut sends the latest answer; failures are toasted', async () => {
  const page = await openChatGPT();
  const shortcut = () =>
    h.evalSW(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
      return aiRouter.handleCommand('send-latest-answer', tab);
    });

  const result = await shortcut();
  assert.equal(result.sent, true);
  assert.equal((await claudeMessages()).length, 1);

  await page.close();
  const streaming = await openChatGPT({ layout: 'turn-key', streaming: true });
  assert.equal(await shortcut(), null);
  const toast = streaming.locator('[data-ai-router-toasts] .toast[data-tone="error"]');
  await toast.waitFor();
  assert.match(await toast.textContent(), /encore en train de répondre/);
});

test('button and shortcut on the same answer at once → sent only once', async () => {
  const page = await openChatGPT();
  const shortcut = h.evalSW(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
    return aiRouter.handleCommand('send-latest-answer', tab);
  });
  await clickSend(page);
  await shortcut;
  await claudeMessages();
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal((await h.pagesOf('claude.ai')[0].evaluate(() => window.__sent)).length, 1);
});

test('answers without selection id still get working buttons for THEIR answer', async () => {
  const page = await openChatGPT({ layout: 'turn-key', noSelectionId: true });
  await clickSend(page, 0);
  assert.deepEqual(await claudeMessages(), ['Première réponse.']);
});

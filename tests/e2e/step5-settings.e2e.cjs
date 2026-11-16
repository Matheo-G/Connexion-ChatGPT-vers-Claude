/**
 * Step 5 — options page, settings that really change behaviour, theme,
 * local history in the popup, quick send.
 * Run: npm run test:e2e
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');

let h;
const BUTTON = '[data-ai-router-button]';

before(async () => {
  h = await launch();
});

after(async () => {
  await h?.close();
});

beforeEach(async () => {
  Object.assign(h.control, { hang: null, fixture: {}, chatgpt: { layout: 'turn-key' }, loggedOut: false });
  await h.evalSW(async () => {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
  });
  // Close everything but the harness's messaging probe (the first options page).
  const probe = h.context.pages().find((p) => p.url().endsWith('/src/options/options.html'));
  for (const page of h.context.pages()) {
    if (page !== probe && /chatgpt\.com|claude\.ai|options\.html|popup\.html/.test(page.url())) await page.close();
  }
});

/** What Chrome actually assigned (a test browser may leave the suggested key unset). */
const assignedShortcut = () =>
  h.evalSW(async () => (await chrome.commands.getAll()).find((c) => c.name === 'send-latest-answer')?.shortcut ?? '');

const storedSettings = () => h.evalSW(async () => (await chrome.storage.sync.get('settings')).settings ?? {});

async function openOptions() {
  const page = await h.context.newPage();
  await page.goto(`chrome-extension://${h.extensionId}/src/options/options.html`);
  await page.locator('body[data-ready="true"]').waitFor();
  return page;
}

async function openChatGPT() {
  const page = await h.context.newPage();
  await page.goto('https://chatgpt.com/c/demo');
  await page.locator(BUTTON).first().waitFor();
  return page;
}

async function sendLatestWithButton() {
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .main`).last().click();
  await page.waitForFunction((sel) => ['success', 'error'].includes(document.querySelectorAll(sel)[1]?.dataset.state), BUTTON, {
    timeout: 30_000,
  });
  return page;
}

test('options page: every section rendered with the stored values', async () => {
  await h.evalSW(() => chrome.storage.sync.set({ settings: { autoSend: false, theme: 'dark' } }));
  const page = await openOptions();

  const titles = await page.locator('.section__title').allTextContents();
  assert.deepEqual(titles, [
    'Destination',
    'Après l’envoi'.replace('’', "'"),
    'Workflows',
    'Raccourci clavier',
    'Apparence',
    'Historique et confidentialité',
    'Avancé',
  ]);
  assert.equal(await page.isChecked('#setting-autoSend'), false);
  assert.equal(await page.isChecked('#setting-newConversation'), true);
  assert.equal(await page.inputValue('#setting-defaultTarget'), 'claude');
  assert.equal(await page.isChecked('#setting-theme-dark'), true);
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  assert.equal(await page.textContent('#shortcut-keys'), (await assignedShortcut()) || 'Non défini');
});

test('a change is saved immediately and confirmed', async () => {
  const page = await openOptions();
  await page.click('#setting-returnToSource');
  await page.locator('#saved[data-visible="true"]').waitFor();
  assert.equal((await storedSettings()).returnToSource, true);
});

test('corrupted stored values fall back to defaults', async () => {
  await h.evalSW(() => chrome.storage.sync.set({ settings: { theme: 'purple', autoSend: 'oui' } }));
  const page = await openOptions();
  assert.equal(await page.isChecked('#setting-theme-auto'), true);
  assert.equal(await page.isChecked('#setting-autoSend'), true);
});

test('turning "auto send" off in the options really changes the send', async () => {
  const options = await openOptions();
  await options.click('#setting-autoSend');
  await options.locator('#saved[data-visible="true"]').waitFor();

  const chatgpt = await sendLatestWithButton();
  assert.equal(await chatgpt.locator(`${BUTTON} .label`).nth(1).textContent(), 'Inséré');
  assert.deepEqual(await h.pagesOf('claude.ai')[0].evaluate(() => window.__sent), []);
});

test('theme choice applies to the options page and the popup', async () => {
  const options = await openOptions();
  await options.click('label[for="setting-theme-light"]');
  await options.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await options.click('label[for="setting-theme-auto"]');
  await options.waitForFunction(() => !document.documentElement.dataset.theme);

  await options.click('label[for="setting-theme-dark"]');
  const popup = await h.openPopup();
  assert.equal(await popup.getAttribute('html', 'data-theme'), 'dark');
});

test('other pages follow a change live', async () => {
  const options = await openOptions();
  await h.evalSW(() => chrome.storage.sync.set({ settings: { debugMode: true } }));
  await options.waitForFunction(() => document.getElementById('setting-debugMode').checked);
});

test('history: sends and failures listed in the popup, newest first', async () => {
  await sendLatestWithButton();
  h.control.loggedOut = true;
  await sendLatestWithButton();

  const popup = await h.openPopup();
  const items = popup.locator('.history__item');
  await items.nth(1).waitFor();
  assert.equal(await items.count(), 2);

  assert.equal(await items.nth(0).getAttribute('data-status'), 'failed');
  assert.match(await items.nth(0).locator('.history__preview').textContent(), /pas connecté/);
  assert.match(await items.nth(0).locator('.history__meta').textContent(), /^Échec · Claude · /);

  assert.equal(await items.nth(1).getAttribute('data-status'), 'sent');
  assert.match(await items.nth(1).locator('.history__preview').textContent(), /^## Écran de connexion Voici un prompt/);
  assert.match(await items.nth(1).locator('.history__meta').textContent(), /^Envoyé · Claude · maintenant$/);
  assert.equal(await items.nth(1).locator('.history__open').count(), 1, 'link back to the Claude conversation');
});

test('history disabled → nothing recorded, popup says so', async () => {
  await h.evalSW(() => chrome.storage.sync.set({ settings: { keepHistory: false } }));
  await sendLatestWithButton();
  assert.deepEqual(await h.evalSW(async () => (await chrome.storage.local.get('history')).history ?? []), []);
  const popup = await h.openPopup();
  assert.match(await popup.textContent('#history-list'), /Historique désactivé/);
});

test('clear history and reset settings need a second click', async () => {
  await sendLatestWithButton();
  await h.evalSW(() => chrome.storage.sync.set({ settings: { autoSend: false, theme: 'dark' } }));
  const options = await openOptions();

  await options.click('#action-clear-history');
  assert.equal(await options.textContent('#action-clear-history'), 'Confirmer ?');
  assert.equal((await h.evalSW(async () => (await chrome.storage.local.get('history')).history))?.length, 1);
  await options.click('#action-clear-history');
  await options.waitForFunction(() => document.getElementById('action-clear-history').textContent === "C'est fait");
  assert.equal(await h.evalSW(async () => (await chrome.storage.local.get('history')).history), undefined);

  await options.click('#action-reset-settings');
  await options.click('#action-reset-settings');
  await options.waitForFunction(() => document.getElementById('setting-autoSend').checked);
  assert.equal((await storedSettings()).theme, 'auto');
});

test('popup quick send: latest ChatGPT answer → Claude', async () => {
  await openChatGPT();
  const popup = await h.openPopup();
  assert.equal(await popup.textContent('#quick-send .button__label'), 'Envoyer la dernière réponse à Claude');
  const shortcut = await assignedShortcut();
  if (shortcut) assert.match(await popup.textContent('#shortcut-hint'), new RegExp(shortcut.replace(/\+/g, '\\+')));
  else assert.equal(await popup.isHidden('#shortcut-hint'), true);

  await popup.click('#quick-send');
  await popup.locator('#feedback[data-tone="success"]').waitFor({ timeout: 30_000 });
  const claude = h.pagesOf('claude.ai')[0];
  await claude.waitForFunction(() => window.__sent?.length === 1);
});

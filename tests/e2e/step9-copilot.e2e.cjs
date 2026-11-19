/**
 * v1.1 — Copilot as a destination (Lexical editor), destination chosen in the
 * button menu or named in the (dictated) message, default workflow notes.
 * Run: npm run test:e2e
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');
const { nonEmptyLines } = require('./expected.cjs');

let h;
const BUTTON = '[data-ai-router-button]';
const MENU = '[data-ai-router-menu]';

before(async () => {
  h = await launch();
});

after(async () => {
  await h?.close();
});

beforeEach(async () => {
  Object.assign(h.control, {
    hang: null,
    fixture: {},
    chatgpt: { layout: 'turn-key' },
    loggedOut: false,
    copilot: {},
    copilotLoggedOut: false,
  });
  h.control.copilotLoads.length = 0;
  await h.evalSW(async () => {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
  });
  const probe = h.context.pages().find((p) => p.url().endsWith('options.html?probe'));
  for (const page of h.context.pages()) {
    if (page !== probe && /chatgpt|claude\.ai|cloud\.microsoft|microsoftonline|options\.html|popup\.html/.test(page.url())) {
      await page.close();
    }
  }
});

const deliver = (text, options = {}) =>
  h.sendMessage({ type: 'pipeline/deliver-text', payload: { providerId: 'copilot', text, ...options } });

async function received(host) {
  for (let i = 0; i < 300; i += 1) {
    const page = h.pagesOf(host)[0];
    const sent = page && (await page.evaluate(() => window.__sent).catch(() => null));
    if (sent?.length) return sent[0];
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${host} received nothing`);
}

async function openChatGPT(prompt) {
  if (prompt) h.control.chatgpt = { layout: 'turn-key', prompt };
  const page = await h.context.newPage();
  await page.goto('https://chatgpt.com/c/demo');
  await page.waitForFunction((sel) => document.querySelectorAll(sel).length === 2, BUTTON);
  return page;
}

// ---- Copilot (Lexical) ---------------------------------------------------------

test('Copilot: multi-line text pasted into the Lexical editor and sent', async () => {
  const text = '# Brief\n\n- point 1\n- point 2\n\n```js\nconst a = 1;\n```';
  const res = await deliver(text);
  assert.equal(res.ok, true, JSON.stringify(res.error));
  assert.equal(res.data.insertedWith, 'paste', 'Lexical only accepts a paste');
  assert.equal(res.data.sentWith, 'button');
  assert.deepEqual(nonEmptyLines(await received('cloud.microsoft')), nonEmptyLines(text));
});

test('Copilot: "insert only" leaves the text in the composer', async () => {
  const res = await deliver('À relire avant envoi', { autoSend: false });
  assert.equal(res.data.sent, false);
  const page = h.pagesOf('cloud.microsoft')[0];
  assert.equal((await page.locator('#m365-chat-editor-target-element').innerText()).trim(), 'À relire avant envoi');
});

test('Copilot: signed out (redirect to Microsoft login) → clear error, no retry', async () => {
  h.control.copilotLoggedOut = true;
  const res = await deliver('Bonjour');
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'TARGET_NOT_LOGGED_IN');
  assert.equal(h.control.copilotLoads.length, 1, 'a single attempt');
});

test('Copilot: listed in the popup connections and diagnosable', async () => {
  const page = await h.context.newPage();
  await page.goto('https://copilot.cloud.microsoft/chat');
  await page.locator('#m365-chat-editor-target-element[data-lexical-editor="true"]').waitFor();
  const popup = await h.openPopup();
  await popup.locator('.provider[data-state="ready"]', { hasText: 'Copilot' }).waitFor();
  const diag = await h.sendMessage({ type: 'ui/diagnose', payload: { providerId: 'copilot' } });
  assert.match(diag.data.text, /diagnostic Copilot/);
  assert.match(diag.data.text, /éditeur : true — bouton d'envoi : true/);
  assert.match(diag.data.text, /### Cadres \(iframes\) : 0/);
});

// ---- Choosing the destination ------------------------------------------------------

test('button menu: "Envoyer vers" lists Claude and Copilot; Copilot receives the Figma prompt', async () => {
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .more`).nth(1).click();
  const menu = page.locator(MENU);
  await menu.waitFor();
  assert.deepEqual(await menu.locator('[data-section="targetProviderId"] button').allTextContents(), ['Claude', 'Copilot']);
  assert.equal(await menu.locator('button[data-target="claude"]').getAttribute('aria-current'), 'true');
  await menu.locator('button[data-target="copilot"]').click();

  const sent = await received('cloud.microsoft');
  assert.match(sent, /Tu es designer UI\/UX senior/, 'the detected /figma workflow still applies');
  assert.equal(h.pagesOf('claude.ai').length, 0, 'Claude untouched');
});

test('dictated routing: "…, envoie-le à Copilot." → button shows Copilot, phrase removed from the prompt', async () => {
  const page = await openChatGPT('/figma crée un écran de connexion, envoie-le à Copilot.');
  assert.equal(await page.locator(`${BUTTON} .label`).nth(1).textContent(), 'Copilot');
  assert.equal(await page.locator(`${BUTTON} .badge`).nth(1).textContent(), '/figma');
  await page.locator(`${BUTTON} .main`).nth(1).click();

  const sent = await received('cloud.microsoft');
  assert.match(sent, /Ma demande initiale\s+crée un écran de connexion\./);
  assert.doesNotMatch(sent, /envoie-le à Copilot/i, 'routing is the extension’s job, not Copilot’s');
});

test('a message merely mentioning Claude does not reroute', async () => {
  const page = await openChatGPT('/mail réponds à Claude, ma collègue, pour décaler la réunion');
  assert.equal(await page.locator(`${BUTTON} .label`).nth(1).textContent(), 'Claude');
});

// ---- Default workflow notes ----------------------------------------------------------

test('default /figma notes are sent until edited; options can restore them', async () => {
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .main`).nth(1).click();
  assert.match(await received('claude.ai'), /Agis directement dans Figma via le connecteur MCP/);

  const options = await h.context.newPage();
  await options.goto(`chrome-extension://${h.extensionId}/src/options/options.html`);
  await options.locator('body[data-ready="true"]').waitFor();
  const box = options.locator('#notes-figma');
  assert.match(await box.inputValue(), /^Agis directement dans Figma/);
  const row = options.locator('.row[data-workflow="figma"]');
  assert.match(await row.locator('.notes__todo').textContent(), /\[iPhone 393×852\]/);
  assert.equal(await row.locator('.notes__reset').isHidden(), true);

  await box.fill('Ma propre consigne.');
  await options.locator('#saved[data-visible="true"]').waitFor();
  assert.equal(await row.locator('.notes__reset').isVisible(), true);
  assert.equal(await row.locator('.notes__todo').isHidden(), true);

  await row.locator('.notes__reset').click();
  assert.match(await box.inputValue(), /^Agis directement dans Figma/);
  const stored = await h.evalSW(async () => (await chrome.storage.local.get('workflowNotes')).workflowNotes ?? {});
  assert.ok(!('figma' in stored), 'override forgotten');
});

test('emptying the notes is respected (no default re-added)', async () => {
  await h.evalSW(() => chrome.storage.local.set({ workflowNotes: { figma: '' } }));
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .main`).nth(1).click();
  const sent = await received('claude.ai');
  assert.doesNotMatch(sent, /Consignes personnelles/);
});

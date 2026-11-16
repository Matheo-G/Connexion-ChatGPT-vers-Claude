/**
 * Step 7 — workflows: "/figma" detection and badge, workflow menu, default
 * workflow, personal instructions, history label.
 * Run: npm run test:e2e
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');
const { EXPECTED, nonEmptyLines } = require('./expected.cjs');

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
  Object.assign(h.control, { hang: null, fixture: {}, chatgpt: { layout: 'turn-key' }, loggedOut: false, fixtureQueue: [] });
  await h.evalSW(async () => {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
  });
  const probe = h.context.pages().find((p) => p.url().endsWith('/src/options/options.html'));
  for (const page of h.context.pages()) {
    if (page !== probe && /chatgpt\.com|claude\.ai|options\.html|popup\.html/.test(page.url())) await page.close();
  }
});

/** In the fixture, answer 1 follows "Bonjour" and answer 2 follows "/figma Crée un écran de connexion". */
async function openChatGPT() {
  const page = await h.context.newPage();
  await page.goto('https://chatgpt.com/c/demo');
  await page.waitForFunction((sel) => document.querySelectorAll(sel).length === 2, BUTTON);
  return page;
}

async function receivedByClaude() {
  for (let i = 0; i < 300; i += 1) {
    const page = h.pagesOf('claude.ai')[0];
    const sent = page && (await page.evaluate(() => window.__sent).catch(() => null));
    if (sent?.length) return sent[0];
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Claude received nothing');
}

const badgeOf = (page, index) => page.locator(`${BUTTON} .badge`).nth(index);

test('"/figma" at the start of the prompt: badge on that answer only', async () => {
  const page = await openChatGPT();
  assert.equal(await badgeOf(page, 1).textContent(), '/figma');
  assert.equal(await badgeOf(page, 1).isVisible(), true);
  assert.equal(await badgeOf(page, 0).isVisible(), false);
  assert.match(await page.locator(`${BUTTON} .main`).nth(1).getAttribute('title'), /workflow « Design Figma »/);
});

test('click → Claude receives the Figma prompt wrapping the intact answer', async () => {
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .main`).nth(1).click();
  const sent = await receivedByClaude();
  assert.match(sent, /Tu es designer UI\/UX senior/);
  assert.match(sent, /connecteur Figma \(MCP\)/);
  for (const line of nonEmptyLines(EXPECTED)) assert.ok(sent.includes(line), `answer line kept: ${line}`);
});

test('turning detection off removes badges live and sends the raw answer', async () => {
  const page = await openChatGPT();
  const options = await h.context.newPage();
  await options.goto(`chrome-extension://${h.extensionId}/src/options/options.html`);
  await options.locator('body[data-ready="true"]').waitFor();
  await options.click('#setting-detectSlashCommands');
  await options.locator('#saved[data-visible="true"]').waitFor();

  await page.bringToFront();
  await page.waitForFunction((sel) => !document.querySelectorAll(sel)[1]?.shadowRoot.querySelector('.badge:not([hidden])'), BUTTON);
  await page.locator(`${BUTTON} .main`).nth(1).click();
  assert.deepEqual(nonEmptyLines(await receivedByClaude()), nonEmptyLines(EXPECTED));
});

test('workflow menu: six workflows, keyboard navigation, outside the page layout', async () => {
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .more`).nth(0).click();
  const menu = page.locator(MENU);
  await menu.waitFor();

  assert.deepEqual(await menu.locator('button').allTextContents(), [
    'Envoyer tel quel',
    'Design Figma/figma',
    'Développement/code',
    'Vidéo Higgsfield/video',
    "Recherche d'emploi/job",
    "Rédaction d'e-mail/mail",
  ]);
  assert.equal(await page.evaluate((sel) => document.querySelector(sel).parentElement === document.body, MENU), true);
  const box = await menu.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box.y >= 0 && box.y + box.height <= viewport.height, 'menu fully visible');

  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate((sel) => document.querySelector(sel).shadowRoot.activeElement?.dataset.workflow, MENU), 'figma');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached' });
});

test('choosing "Développement" in the menu overrides the detected command', async () => {
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .more`).nth(1).click();
  await page.locator(`${MENU} button[data-workflow="code"]`).click();
  const sent = await receivedByClaude();
  assert.match(sent, /Tu es ingénieur logiciel senior/);
  assert.doesNotMatch(sent, /designer UI\/UX/);
});

test('default workflow applies when the prompt has no command', async () => {
  await h.evalSW(() => chrome.storage.sync.set({ settings: { defaultWorkflow: 'mail' } }));
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .main`).nth(0).click(); // answer to "Bonjour"
  const sent = await receivedByClaude();
  assert.match(sent, /Rédige un e-mail prêt à envoyer/);
  assert.match(sent, /Première réponse\./);
});

test('personal instructions written in the options are appended', async () => {
  const options = await h.context.newPage();
  await options.goto(`chrome-extension://${h.extensionId}/src/options/options.html`);
  await options.locator('body[data-ready="true"]').waitFor();
  await options.fill('#notes-figma', 'Utilise mon design system « Nova ».');
  await options.locator('#saved[data-visible="true"]').waitFor();

  const page = await openChatGPT();
  await page.locator(`${BUTTON} .main`).nth(1).click();
  const sent = await receivedByClaude();
  assert.match(sent, /Consignes personnelles \(prioritaires\)/);
  assert.match(sent, /Utilise mon design system « Nova »\./);

  await options.reload();
  await options.locator('body[data-ready="true"]').waitFor();
  assert.equal(await options.inputValue('#notes-figma'), 'Utilise mon design system « Nova ».');
});

test('history shows which workflow was used', async () => {
  const page = await openChatGPT();
  await page.locator(`${BUTTON} .main`).nth(1).click();
  await receivedByClaude();
  const popup = await h.openPopup();
  const meta = popup.locator('.history__item .history__meta').first();
  await meta.waitFor();
  assert.match(await meta.textContent(), /^Envoyé · Claude · Design Figma · /);
});

test('a Figma link in the prompt reaches Claude, even when ChatGPT shortens it', async () => {
  const figma = 'https://www.figma.com/design/AbC123xyz/App-mobile?node-id=12-345';
  h.control.chatgpt = {
    layout: 'turn-key',
    // Shortened label, full address only in href — plus a plain-text link.
    prompt: `/figma Améliore <a href="${figma}">figma.com</a> selon https://exemple.fr/brief.`,
  };
  const page = await openChatGPT();
  assert.equal(await badgeOf(page, 1).textContent(), '/figma');
  await page.locator(`${BUTTON} .main`).nth(1).click();
  const sent = await receivedByClaude();
  assert.match(sent, /Travaille dans le fichier Figma existant/);
  assert.ok(sent.includes(figma), 'full Figma address forwarded');
  assert.ok(sent.includes('https://exemple.fr/brief'), 'other link forwarded, without the final dot');
  assert.ok(!sent.includes('https://exemple.fr/brief.'), 'sentence punctuation not glued to the link');
});

/**
 * Step 9 — the way back: "↩ ChatGPT" under Claude's answers sends the answer
 * to the ChatGPT conversation the brief came from.
 * Run: npm run test:e2e
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');

let h;
const BUTTON = '[data-ai-router-button]';
const TOAST = '[data-ai-router-toasts] .toast';

before(async () => {
  h = await launch();
});

after(async () => {
  await h?.close();
});

beforeEach(async () => {
  Object.assign(h.control, { hang: null, fixture: {}, chatgpt: { layout: 'turn-key' }, loggedOut: false });
  h.control.fixtureQueue.length = 0;
  await h.evalSW(async () => {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  });
  const probe = h.context.pages().find((p) => p.url().endsWith('options.html?probe'));
  for (const page of h.context.pages()) {
    if (page !== probe && /chatgpt|claude\.ai|options\.html|popup\.html/.test(page.url())) await page.close();
  }
});

const sentIn = (page) => page.evaluate(() => window.__sent ?? []).catch(() => []);

async function waitForSent(page) {
  for (let i = 0; i < 300; i += 1) {
    const sent = await sentIn(page);
    if (sent.length) return sent;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${page.url()} received nothing`);
}

async function openClaude(fixture = { conversation: true }, path = '/chat/demo') {
  h.control.fixture = fixture;
  const page = await h.context.newPage();
  await page.goto(`https://claude.ai${path}`);
  return page;
}

/** Sends the ChatGPT brief with "➤ Claude" and returns the Claude page once it has answered. */
async function briefAndWaitForClaude(origin) {
  await origin.waitForFunction((sel) => document.querySelectorAll(sel).length === 2, BUTTON);
  await origin.locator(`${BUTTON} .main`).nth(1).click(); // "/figma Crée un écran de connexion"
  for (let i = 0; i < 150; i += 1) {
    const page = h.pagesOf('claude.ai')[0];
    if (page && (await page.locator(BUTTON).count().catch(() => 0))) return page;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Claude did not answer the brief');
}

async function openChatGPT(path = '/c/demo') {
  const page = await h.context.newPage();
  await page.goto(`https://chatgpt.com${path}`);
  await page.locator('#prompt-textarea.ProseMirror').waitFor();
  return page;
}

// ---- The button --------------------------------------------------------------

test('Claude: "↩ ChatGPT" button in the action bar of each answer', async () => {
  const page = await openClaude();
  const button = page.locator(`[role="group"][aria-label="Message actions"] > ${BUTTON}`);
  await button.waitFor();
  assert.equal(await button.locator('.label').textContent(), 'ChatGPT');
  assert.equal(await button.locator('.more').isHidden(), true, 'no menu on the way back');
  assert.match(await button.locator('.main').getAttribute('aria-label'), /^ChatGPT — Renvoyer cette réponse à ChatGPT/);
});

test('no button while Claude writes; it appears once the answer is complete', async () => {
  const page = await openClaude({ conversation: true, streaming: true, streamMs: 1_500 });
  await page.locator('#stop').waitFor();
  await page.waitForTimeout(600);
  assert.equal(await page.locator(BUTTON).count(), 0);
  await page.locator(BUTTON).waitFor({ timeout: 5_000 });
  assert.equal(await page.locator('#stop').count(), 0);
});

test('answer without action bar: the button goes at the end of the answer', async () => {
  const page = await openClaude({ conversation: true, noActionBar: true });
  await page.locator(`[data-is-streaming="false"] > ${BUTTON}`).waitFor();
});

// ---- Sending back --------------------------------------------------------------

test('click → ChatGPT receives Claude’s answer as clean Markdown (tools, thinking and UI left out)', async () => {
  const chatgpt = await openChatGPT();
  const claude = await openClaude();
  await claude.locator(`${BUTTON} .main`).click();

  const [text] = await waitForSent(chatgpt);
  assert.match(text, /^↩ Retour de Claude\n/);
  assert.match(text, /Je crée la frame dans \*\*Figma\*\*\./);
  assert.match(text, /## Résultat/);
  assert.match(text, /- Frame `IA · Hello` créée/);
  assert.match(text, /```javascript\nconst frame = figma\.createFrame\(\);\nframe\.name = "IA · Hello";\n```/);
  assert.match(text, /\[fichier\]\(https:\/\/www\.figma\.com\/design\/abc\)/);
  assert.match(text, /> 📎 Artefact dans Claude : Spécification de la frame/);
  for (const leak of ['Pensée cachée', 'use_figma', 'Copier', 'Réessayer', 'écris Hello']) {
    assert.ok(!text.includes(leak), `"${leak}" must not be sent`);
  }
  await claude.locator(`${BUTTON}[data-state="success"]`).waitFor();
});

test('full loop: the result goes back to the ChatGPT conversation of the brief, not the latest tab', async () => {
  h.control.fixture = { autoReply: true, replyMs: 300 };
  const origin = await openChatGPT('/c/brief');
  const claude = await briefAndWaitForClaude(origin);
  assert.match(new URL(claude.url()).pathname, /^\/chat\//);

  // Meanwhile the user opened another ChatGPT conversation, now the most recent tab.
  const other = await openChatGPT('/c/other');
  await other.bringToFront();

  await claude.bringToFront();
  await claude.locator(`${BUTTON} .main`).click();

  const [text] = await waitForSent(origin);
  assert.match(text, /^↩ Retour de Claude · \/figma\n+Fait : /, 'header names the brief’s command');
  assert.deepEqual(await sentIn(other), [], 'the other conversation is untouched');
});

test('ChatGPT closed meanwhile: its conversation is reopened at the same address', async () => {
  h.control.fixture = { autoReply: true, replyMs: 200 };
  const origin = await openChatGPT('/c/brief');
  const claude = await briefAndWaitForClaude(origin);
  await origin.close();

  await claude.locator(`${BUTTON} .main`).click();
  await claude.locator(`${BUTTON}[data-state="success"]`).waitFor({ timeout: 20_000 });
  const reopened = h.pagesOf('chatgpt.com')[0];
  assert.equal(new URL(reopened.url()).pathname, '/c/brief');
  assert.match((await sentIn(reopened))[0], /^↩ Retour de Claude · \/figma/);
});

test('no brief known (conversation started by hand) → the current ChatGPT tab', async () => {
  const chatgpt = await openChatGPT('/c/current');
  const claude = await openClaude();
  await claude.locator(`${BUTTON} .main`).click();
  const [text] = await waitForSent(chatgpt);
  assert.match(text, /^↩ Retour de Claude\n+Je crée/, 'no command in the header');
  assert.equal(new URL(chatgpt.url()).pathname, '/c/current', 'same conversation, not a new chat');
});

test('"insert only" setting: the text waits in ChatGPT’s composer', async () => {
  await h.evalSW(() => chrome.storage.sync.set({ settings: { autoSend: false } }));
  const chatgpt = await openChatGPT();
  const claude = await openClaude();
  await claude.locator(`${BUTTON} .main`).click();
  await claude.locator(`${BUTTON}[data-state="success"]`).waitFor({ timeout: 20_000 });
  assert.equal(await claude.locator(`${BUTTON} .label`).textContent(), 'Inséré');
  assert.match(await chatgpt.locator('#prompt-textarea').innerText(), /↩ Retour de Claude/);
  assert.deepEqual(await sentIn(chatgpt), []);
});

test('ChatGPT still answering → clear error, nothing typed, its "stop" never clicked', async () => {
  h.control.chatgpt = { layout: 'turn-key', streaming: true };
  const chatgpt = await openChatGPT();
  const claude = await openClaude();
  await claude.locator(`${BUTTON} .main`).click();
  const toast = claude.locator(`${TOAST}[data-tone="error"]`);
  await toast.waitFor({ timeout: 20_000 });
  assert.match(await toast.textContent(), /encore en train de répondre/);
  assert.equal((await chatgpt.locator('#prompt-textarea').innerText()).trim(), '');
  assert.equal(await chatgpt.locator('#composer-button').getAttribute('aria-label'), 'Arrêter la génération');
});

test('a very long answer becomes a ChatGPT attachment and is still sent', async () => {
  const chatgpt = await openChatGPT();
  const claude = await openClaude();
  await claude.evaluate(() => {
    const md = document.querySelectorAll('.standard-markdown')[2];
    md.insertAdjacentHTML('beforeend', `<p>${'Une très longue réponse. '.repeat(250)}</p>`);
  });
  await claude.locator(`${BUTTON} .main`).click();
  const [text] = await waitForSent(chatgpt);
  assert.ok(text.length > 4000);
  assert.match(text, /Une très longue réponse\./);
});

// ---- Status and diagnostic ------------------------------------------------------------

test('diagnostic Claude describes the conversation without its text', async () => {
  await openClaude();
  const diag = await h.sendMessage({ type: 'ui/diagnose', payload: { providerId: 'claude' } });
  const { text } = diag.data;
  assert.match(text, /### Conversation — réponses : 1 — génération en cours : false — reconnue : true/);
  assert.match(text, /action-bar-copy/);
  assert.match(text, /\[data-is-streaming="false"\]/);
  for (const leak of ['Hello', 'Figma', 'Résultat', 'createFrame']) assert.ok(!text.includes(leak), `"${leak}" leaked`);
});

test('popup: Claude conversation recognised (ready)', async () => {
  await openClaude();
  const popup = await h.openPopup();
  await popup.locator('.provider[data-state="ready"]', { hasText: 'Claude' }).waitFor();
});

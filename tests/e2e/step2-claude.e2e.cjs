/**
 * Step 2 — Claude adapter: insert text into the Tiptap/ProseMirror editor
 * and send it, with every fallback and failure mode.
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
  Object.assign(h.control, { hang: null, fixture: {}, loggedOut: false });
  for (const page of h.pagesOf('claude.ai')) await page.close();
});

/** Sends DELIVER_TEXT like the pipeline will, returns the raw response. */
const deliver = (text, options = {}) =>
  h.sendMessage({ type: 'pipeline/deliver-text', payload: { providerId: 'claude', text, ...options } });

const claudePage = () => h.pagesOf('claude.ai')[0];
const sentMessages = () => claudePage().evaluate(() => window.__sent);
const editorText = async () => (await claudePage().locator('.ProseMirror').innerText()).trim();

/** ProseMirror turns each line into a paragraph and drops empty lines. */
const nonEmptyLines = (text) => text.split('\n').filter((line) => line.trim());

function assertOk(res) {
  assert.equal(res.ok, true, `expected success, got ${JSON.stringify(res.error)}`);
  return res.data;
}

test('short text → pasted, sent with the button, conversation created', async () => {
  const data = assertOk(await deliver('Bonjour Claude, peux-tu m’aider ?'));
  assert.equal(data.insertedWith, 'paste');
  assert.equal(data.sentWith, 'button');
  assert.deepEqual(await sentMessages(), ['Bonjour Claude, peux-tu m’aider ?']);
  assert.match(claudePage().url(), /\/chat\/\d+$/);
  assert.equal(await editorText(), '', 'composer is empty after sending');
});

test('multi-line Markdown keeps its lines, order and indentation', async () => {
  const text = [
    '# Prompt Figma',
    '',
    'Crée un écran de connexion :',
    '- champ **email**',
    '- bouton `Continuer`',
    '',
    '```js',
    'function hello() {',
    '  return "monde";',
    '}',
    '```',
  ].join('\n');

  assertOk(await deliver(text));
  const [sent] = await sentMessages();
  assert.deepEqual(nonEmptyLines(sent), nonEmptyLines(text));
});

test('autoSend=false → text left in the composer, nothing sent', async () => {
  const data = assertOk(await deliver('Brouillon à relire', { autoSend: false }));
  assert.equal(data.sent, false);
  assert.equal(await editorText(), 'Brouillon à relire');
  assert.deepEqual(await sentMessages(), []);
  assert.match(claudePage().url(), /\/new$/);
});

test('paste ignored by the site → falls back to execCommand typing', async () => {
  h.control.fixture = { ignorePaste: true };
  const text = 'Ligne 1\nLigne 2\nLigne 3';
  const data = assertOk(await deliver(text));
  assert.equal(data.insertedWith, 'execCommand');
  assert.deepEqual(nonEmptyLines((await sentMessages())[0]), nonEmptyLines(text));
});

test('paste and typing both blocked → falls back to DOM rewrite', async () => {
  h.control.fixture = { ignorePaste: true, blockTyping: true };
  const data = assertOk(await deliver('Dernier recours\nmais ça passe'));
  assert.equal(data.insertedWith, 'dom');
  assert.deepEqual(nonEmptyLines((await sentMessages())[0]), ['Dernier recours', 'mais ça passe']);
});

test('very long text → Claude makes it an attachment, still sent', async () => {
  const text = 'Contexte détaillé. '.repeat(400); // ~7 600 chars
  const data = assertOk(await deliver(text));
  assert.equal(data.insertedWith, 'paste');
  assert.equal((await sentMessages())[0].trim(), text.trim());
});

test('send button ignores clicks → falls back to Enter', async () => {
  h.control.fixture = { brokenButton: true };
  const data = assertOk(await deliver('Envoi par la touche Entrée'));
  assert.equal(data.sentWith, 'enter');
  assert.deepEqual(await sentMessages(), ['Envoi par la touche Entrée']);
});

test('slow hydration (editor mounted after 3 s) → waits for it', async () => {
  h.control.fixture = { mountDelay: 3000 };
  assertOk(await deliver('Patience'));
  assert.deepEqual(await sentMessages(), ['Patience']);
});

test('existing draft is replaced, not appended', async () => {
  h.control.fixture = { draft: 'vieux brouillon' };
  const page = await h.context.newPage();
  await page.goto('https://claude.ai/chat/42');
  assertOk(await deliver('Nouveau message', { newConversation: false }));
  assert.deepEqual(await sentMessages(), ['Nouveau message']);
});

test('logged out → TARGET_NOT_LOGGED_IN and popup status "logged-out"', async () => {
  h.control.loggedOut = true;
  const res = await deliver('Bonjour');
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'TARGET_NOT_LOGGED_IN');

  const status = await h.sendMessage({ type: 'ui/get-status' });
  assert.equal(status.data.find((p) => p.id === 'claude').state, 'logged-out');
});

test('usage limit reached → TARGET_RATE_LIMITED', async () => {
  h.control.fixture = { rateLimited: true };
  const res = await deliver('Encore un message');
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'TARGET_RATE_LIMITED');
});

test('empty text → NO_CONTENT without opening any tab', async () => {
  const res = await deliver('   \n  ');
  assert.equal(res.error.code, 'NO_CONTENT');
  assert.equal(h.pagesOf('claude.ai').length, 0);
});

test('editor never appears → EDITOR_NOT_FOUND', async () => {
  h.control.fixture = { noEditor: true };
  const res = await deliver('Bonjour');
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'EDITOR_NOT_FOUND');
});

test('popup "insert test text" fills Claude without sending', async () => {
  const popup = await h.openPopup({ tools: true });
  await popup.click('#insert-test');
  await popup.locator('#tools-feedback[data-tone="success"]').waitFor({ timeout: 20_000 });

  assert.match(await editorText(), /Test Mathéo AI Router/);
  assert.deepEqual(await sentMessages(), []);
  await popup.close();
});

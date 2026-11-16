/**
 * Step 3 — ChatGPT adapter: read the latest answer as Markdown, refuse while
 * streaming, handle split turns and empty conversations.
 * Run: npm run test:e2e
 */

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./harness.cjs');

let h;

/** What the rich fixture answer must become. */
const EXPECTED = [
  '## Écran de connexion',
  '',
  'Voici un prompt **optimisé** pour *Figma*, avec `Auto Layout`. Source [Figma Help](https://help.figma.com).',
  '',
  '```javascript',
  'const frame = figma.createFrame();',
  'frame.layoutMode = "VERTICAL";',
  '```',
  '',
  '- Champs',
  '  - Email',
  '  - Mot de passe',
  '- Bouton **Continuer**',
  '',
  '| Élément | Espacement |',
  '| --- | --- |',
  '| Champ | 16 px |',
  '| Bouton | 24 px |',
  '',
  'Ratio : $\\frac{16}{9}$',
  '',
  '> Garde une palette sobre.',
].join('\n');

before(async () => {
  h = await launch();
});

after(async () => {
  await h?.close();
});

beforeEach(async () => {
  Object.assign(h.control, { hang: null, fixture: {}, chatgpt: {}, loggedOut: false });
  for (const page of [...h.pagesOf('chatgpt.com'), ...h.pagesOf('claude.ai')]) await page.close();
});

async function openChatGPT(scenario = {}) {
  h.control.chatgpt = scenario;
  const page = await h.context.newPage();
  await page.goto('https://chatgpt.com/c/demo');
  return page;
}

const read = (payload = {}) => h.sendMessage({ type: 'ui/read-source', payload });

function assertOk(res) {
  assert.equal(res.ok, true, `expected success, got ${JSON.stringify(res.error)}`);
  return res.data;
}

test('latest answer → faithful Markdown + the prompt that produced it', async () => {
  await openChatGPT();
  const answer = assertOk(await read());
  assert.equal(answer.markdown, EXPECTED);
  assert.equal(answer.prompt, '/figma Crée un écran de connexion');
  assert.equal(answer.messageId, 'a2');
  assert.equal(answer.length, EXPECTED.length);
});

test('a specific older answer can be read by message id', async () => {
  await openChatGPT();
  const answer = assertOk(await read({ messageId: 'a1' }));
  assert.equal(answer.markdown, 'Première réponse.');
  assert.equal(answer.prompt, 'Bonjour');
});

test('while ChatGPT is writing → STILL_GENERATING (older answers stay readable)', async () => {
  await openChatGPT({ streaming: true });
  const res = await read();
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'STILL_GENERATING');
  assert.equal(assertOk(await read({ messageId: 'a1' })).markdown, 'Première réponse.');
});

test('once the answer is complete it becomes readable', async () => {
  const page = await openChatGPT({ streaming: true, streamMs: 1000 });
  assert.equal((await read()).error.code, 'STILL_GENERATING');
  await page.waitForSelector('[data-testid="send-button"]');
  assert.equal(assertOk(await read()).markdown, EXPECTED);
});

test('answer split into several messages → all parts, in order', async () => {
  await openChatGPT({ split: true });
  const answer = assertOk(await read());
  assert.equal(answer.markdown, `Je cherche des références…\n\n${EXPECTED}`);
  assert.equal(answer.messageId, 'a2-part2');
});

test('empty conversation → NO_CONTENT', async () => {
  await openChatGPT({ empty: true });
  const res = await read();
  assert.equal(res.error.code, 'NO_CONTENT');
});

test('no ChatGPT tab → SOURCE_UNAVAILABLE', async () => {
  const res = await read();
  assert.equal(res.error.code, 'SOURCE_UNAVAILABLE');
});

test('popup "read" shows the Markdown preview', async () => {
  await openChatGPT();
  const popup = await h.context.newPage();
  await popup.goto(`chrome-extension://${h.extensionId}/src/popup/popup.html`);
  await popup.click('#read-source');
  await popup.locator('#feedback[data-tone="success"]').waitFor();

  assert.equal(await popup.textContent('#feedback'), `${EXPECTED.length} caractères lus`);
  assert.equal(await popup.textContent('#preview-text'), EXPECTED);
  await popup.close();
});

test('chained: ChatGPT answer read then delivered to Claude intact', async () => {
  await openChatGPT();
  const { markdown } = assertOk(await read());
  assertOk(
    await h.sendMessage({ type: 'pipeline/deliver-text', payload: { providerId: 'claude', text: markdown } }),
  );

  const [sent] = await h.pagesOf('claude.ai')[0].evaluate(() => window.__sent);
  const lines = (text) => text.split('\n').filter((line) => line.trim());
  assert.deepEqual(lines(sent), lines(EXPECTED));
});

// ---- "Chat / Work" layout (data-turn-key), rolled out per account in 2026 ----

test('turn-key layout → same Markdown; hidden cached conversation ignored', async () => {
  await openChatGPT({ layout: 'turn-key' });
  const answer = assertOk(await read());
  assert.equal(answer.layout, 'turn-key');
  assert.equal(answer.markdown, EXPECTED);
  assert.equal(answer.prompt, '/figma Crée un écran de connexion');
  assert.equal(answer.messageId, 'a2');
});

test('turn-key layout rendered twice → no duplicated content', async () => {
  await openChatGPT({ layout: 'turn-key', duplicate: true });
  assert.equal(assertOk(await read()).markdown, EXPECTED);
});

test('turn-key layout, specific answer by id', async () => {
  await openChatGPT({ layout: 'turn-key' });
  const answer = assertOk(await read({ messageId: 'a1' }));
  assert.equal(answer.markdown, 'Première réponse.');
  assert.equal(answer.prompt, 'Bonjour');
});

test('turn-key layout while writing → STILL_GENERATING, never the previous answer', async () => {
  await openChatGPT({ layout: 'turn-key', streaming: true });
  const res = await read();
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'STILL_GENERATING');
});

test('popup diagnostic: layout and markers, without any conversation text', async () => {
  await openChatGPT({ layout: 'turn-key' });
  const popup = await h.context.newPage();
  await popup.goto(`chrome-extension://${h.extensionId}/src/popup/popup.html`);
  await popup.click('#diagnose-source');
  await popup.locator('#feedback[data-tone="success"]').waitFor();

  const text = await popup.textContent('#preview-text');
  assert.match(text, /Layout reconnu : turn-key — réponses : 2/);
  assert.match(text, /\[data-chatgpt-selection-message-id="a2"\]/);
  assert.match(text, /txt:\d+/);
  for (const secret of ['optimisé', 'Première réponse', 'frac', 'Bonjour', 'Figma Help', 'Ancienne']) {
    assert.ok(!text.includes(secret), `diagnostic leaks "${secret}"`);
  }
  await popup.close();
});

test('turn-key layout: the turn state alone reveals writing (no stop button)', async () => {
  await openChatGPT({ layout: 'turn-key', streaming: true, stopButton: false });
  assert.equal((await read()).error.code, 'STILL_GENERATING');
});

/**
 * Unit tests for step 7: workflow registry, slash command detection,
 * resolution priority, prompt composition, personal notes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listWorkflows, getWorkflow, detectWorkflow, resolveWorkflow } from '../src/workflows/registry.js';
import { composePrompt } from '../src/workflows/prompt-kit.js';
import { sanitizeNotes, NOTES_MAX_LENGTH } from '../src/services/workflow-notes.js';
import { iconNames } from '../src/ui-kit/icons.js';

const ANSWER = '# Écran de connexion\n\n- champ email\n\n```js\nconst a = 1;\n```';

test('workflows: unique ids and commands, translated names, known icons', async () => {
  const messages = JSON.parse(await readFile(new URL('../_locales/fr/messages.json', import.meta.url)));
  const workflows = listWorkflows();
  assert.deepEqual(workflows.map((w) => w.id), ['default', 'figma', 'code', 'video', 'job', 'mail']);
  assert.equal(new Set(workflows.map((w) => w.id)).size, workflows.length);
  const commands = workflows.map((w) => w.command).filter(Boolean);
  assert.equal(new Set(commands).size, commands.length);
  for (const w of workflows) {
    assert.ok(messages[w.labelKey]?.message, `missing translation ${w.labelKey}`);
    assert.ok(iconNames().includes(w.icon), `unknown icon ${w.icon}`);
    if (w.command) assert.match(w.command, /^\/[a-z0-9-]+$/);
  }
});

test('every workflow keeps the answer intact and appends personal notes', () => {
  for (const workflow of listWorkflows()) {
    const out = workflow.transform({ text: ANSWER, prompt: '', notes: 'Toujours en anglais.' });
    assert.ok(out.includes(ANSWER), `${workflow.id} must not alter the answer`);
    assert.ok(out.includes('Toujours en anglais.'), `${workflow.id} must include notes`);
    assert.equal(workflow.transform({ text: ANSWER, prompt: '' }).includes('Consignes personnelles'), false);
  }
  assert.equal(getWorkflow('default').transform({ text: ANSWER, prompt: '' }), ANSWER, 'default is a pass-through');
});

test('figma workflow asks Claude to use the Figma connector, with a fallback', () => {
  const out = getWorkflow('figma').transform({ text: ANSWER, prompt: '' });
  assert.match(out, /connecteur Figma \(MCP\)/);
  assert.match(out, /Auto Layout/);
  assert.match(out, /S'il ne l'est pas/);
});

test('slash command detection: first word only, case-insensitive, exact command', () => {
  assert.equal(detectWorkflow('/figma Crée un écran')?.id, 'figma');
  assert.equal(detectWorkflow('  /CODE corrige ce bug')?.id, 'code');
  assert.equal(detectWorkflow('/mail')?.id, 'mail');
  assert.equal(detectWorkflow('/figmax truc'), null);
  assert.equal(detectWorkflow('Crée un écran /figma'), null);
  assert.equal(detectWorkflow('/inconnu test'), null);
  assert.equal(detectWorkflow(''), null);
  assert.equal(detectWorkflow(undefined), null);
});

test('resolution priority: explicit choice > slash command > default', () => {
  const base = { defaultWorkflowId: 'default', detectSlashCommands: true };
  assert.deepEqual(
    [resolveWorkflow({ ...base, workflowId: 'mail', prompt: '/figma x' })].map((r) => [r.workflow.id, r.reason]),
    [['mail', 'explicit']],
  );
  const byCommand = resolveWorkflow({ ...base, prompt: '/video une pub' });
  assert.deepEqual([byCommand.workflow.id, byCommand.reason], ['video', 'command']);
  const byDefault = resolveWorkflow({ ...base, prompt: 'bonjour' });
  assert.deepEqual([byDefault.workflow.id, byDefault.reason], ['default', 'default']);
  const disabled = resolveWorkflow({ ...base, detectSlashCommands: false, prompt: '/figma x', defaultWorkflowId: 'code' });
  assert.deepEqual([disabled.workflow.id, disabled.reason], ['code', 'default']);
  assert.throws(() => resolveWorkflow({ ...base, workflowId: 'nope' }), { code: 'WORKFLOW_NOT_FOUND' });
});

test('composePrompt: instructions first, content untouched, notes last', () => {
  const out = composePrompt({
    intro: 'Rôle.',
    sections: [{ title: 'Règles', items: ['un', 'deux'] }],
    content: ANSWER,
    contentLabel: 'Brief',
    notes: '  Ma consigne  ',
  });
  assert.equal(out, `Rôle.\n\n## Règles\n- un\n- deux\n\n## Brief\n\n${ANSWER}\n\n## Consignes personnelles (prioritaires)\n\nMa consigne`);
});

test('notes are sanitised: strings only, empty dropped, length capped', () => {
  const clean = sanitizeNotes({ figma: 'ok', code: 42, mail: '   ', video: 'x'.repeat(NOTES_MAX_LENGTH + 10) });
  assert.deepEqual(Object.keys(clean), ['figma', 'video']);
  assert.equal(clean.video.length, NOTES_MAX_LENGTH);
  assert.deepEqual(sanitizeNotes(null), {});
});

// ---- Links from the user's message ----------------------------------------

import { extractUrls, isFigmaUrl } from '../src/utils/links.js';

const FIGMA = 'https://www.figma.com/design/AbC123xyz/App-mobile?node-id=12-345&t=k9';

test('extractUrls: trailing punctuation dropped, duplicates removed, order kept', () => {
  const text = `Voici (${FIGMA}). Et https://exemple.fr/doc, puis https://exemple.fr/doc ! Sans http rien.`;
  assert.deepEqual(extractUrls(text), [FIGMA, 'https://exemple.fr/doc']);
  assert.deepEqual(extractUrls('https://fr.wikipedia.org/wiki/Test_(informatique) ok'), [
    'https://fr.wikipedia.org/wiki/Test_(informatique)',
  ]);
  assert.deepEqual(extractUrls(''), []);
  assert.deepEqual(extractUrls(undefined), []);
});

test('isFigmaUrl recognises Figma documents only', () => {
  assert.ok(isFigmaUrl(FIGMA));
  assert.ok(isFigmaUrl('https://figma.com/board/Xy/Board'));
  assert.ok(isFigmaUrl('https://www.figma.com/file/Xy/Old-style'));
  assert.ok(!isFigmaUrl('https://www.figma.com/pricing'));
  assert.ok(!isFigmaUrl('https://figma.com.evil.io/design/Xy'));
  assert.ok(!isFigmaUrl('pas une url'));
});

test('/figma with a Figma link: work IN that file, link kept exactly', () => {
  const out = getWorkflow('figma').transform({ text: ANSWER, prompt: `/figma Améliore cet écran ${FIGMA}` });
  assert.match(out, /Travaille dans le fichier Figma existant/);
  assert.match(out, /ne crée pas de nouveau fichier/);
  assert.ok(out.includes(`Fichier Figma de travail :\n- ${FIGMA}`));
  assert.match(out, /node-id/);
  assert.ok(out.includes(ANSWER));
});

test('/figma without link keeps the "create" instruction', () => {
  const out = getWorkflow('figma').transform({ text: ANSWER, prompt: '/figma Crée un écran' });
  assert.match(out, /Réalise dans Figma le design/);
  assert.doesNotMatch(out, /Fichier Figma de travail/);
});

test('every workflow forwards the links of the user message', () => {
  const prompt = `Regarde https://exemple.fr/brief et ${FIGMA}`;
  for (const workflow of listWorkflows()) {
    const out = workflow.transform({ text: ANSWER, prompt });
    assert.ok(out.includes('https://exemple.fr/brief'), `${workflow.id} forwards links`);
    assert.ok(out.includes(FIGMA), `${workflow.id} forwards the Figma link`);
  }
});

test('default workflow only adds links the answer does not already contain', () => {
  const withLink = `${ANSWER}\n\nVoir https://exemple.fr/brief`;
  assert.equal(getWorkflow('default').transform({ text: withLink, prompt: 'cf https://exemple.fr/brief' }), withLink);
  assert.match(
    getWorkflow('default').transform({ text: ANSWER, prompt: 'cf https://exemple.fr/brief' }),
    /---\n\nLiens fournis dans ma demande :\n- https:\/\/exemple\.fr\/brief$/,
  );
});

// ---- Original request & ChatGPT instructions --------------------------------

import { requestOf } from '../src/workflows/prompt-kit.js';
import { buildChatGPTInstructions, CHATGPT_INSTRUCTIONS_LIMIT } from '../src/workflows/chatgpt-instructions.js';

const USER_CASE =
  '/figma écrit moi "Hello" dans cette frame : https://www.figma.com/design/EsD6vdTEYsOMdl0DuCC1x2/Jalonet---Mobile%F0%9F%93%B1?node-id=6208-5&t=JlWh0w8RK25bKNQW-11';

test('requestOf strips the leading command only', () => {
  assert.equal(requestOf('/figma  écris Hello'), 'écris Hello');
  assert.equal(requestOf('écris /figma Hello'), 'écris /figma Hello');
  assert.equal(requestOf('/figma'), '');
  assert.equal(requestOf(undefined), '');
});

test('real case: ChatGPT refused, Claude still gets the request and the target frame', () => {
  const refusal = "Je ne peux pas modifier directement un fichier Figma.";
  const out = getWorkflow('figma').transform({ text: refusal, prompt: USER_CASE });
  const url = USER_CASE.split(' : ')[1];
  assert.ok(out.includes(`Fichier Figma de travail :\n- ${url}`), 'frame link is the working file');
  assert.match(out, /## Ma demande initiale\n\nécrit moi "Hello" dans cette frame/);
  assert.match(out, /ma demande initiale prime/);
  assert.ok(out.indexOf('Ma demande initiale') < out.indexOf(refusal), 'intent before ChatGPT text');
  assert.equal(out.split(url).length - 1, 2, 'link in the intro and inside the request, nowhere else');
});

test('workflows forward the request without the command; default stays raw', () => {
  for (const workflow of listWorkflows().filter((w) => w.id !== 'default')) {
    const out = workflow.transform({ text: ANSWER, prompt: `${workflow.command} fais ceci` });
    assert.match(out, /## Ma demande initiale\n\nfais ceci/, workflow.id);
  }
  assert.equal(getWorkflow('default').transform({ text: ANSWER, prompt: 'fais ceci' }), ANSWER);
});

test('ChatGPT instructions: every command explained, within ChatGPT limit', () => {
  const text = buildChatGPTInstructions();
  for (const workflow of listWorkflows().filter((w) => w.command)) {
    assert.ok(workflow.chatgptHint, `${workflow.id} needs a chatgptHint`);
    assert.ok(text.includes(`- ${workflow.command} : `), `${workflow.command} listed`);
  }
  assert.match(text, /ne fais pas la tâche toi-même/);
  assert.match(text, /Ne dis jamais que tu ne peux pas le faire/);
  assert.ok(text.length <= CHATGPT_INSTRUCTIONS_LIMIT, `${text.length} > ${CHATGPT_INSTRUCTIONS_LIMIT}`);
});

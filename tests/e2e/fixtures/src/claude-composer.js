/**
 * Realistic stand-in for the claude.ai composer, built on the same editor
 * stack as Claude (Tiptap / ProseMirror). Bundled by the e2e harness.
 *
 * Mimics: French placeholder & send label, send button enabled only with
 * content, Enter sends, long pastes become an attachment, SPA navigation
 * to /chat/<id> after the first message.
 *
 * Behaviour knobs (window.__FIXTURE__, injected by the harness):
 *   mountDelay   ms before the editor appears (slow hydration)
 *   ignorePaste  swallow paste events (forces fallback strategies)
 *   rateLimited  sending shows a usage-limit banner instead
 *   noEditor     never mount the editor
 *   draft        initial editor text
 *   brokenButton the send button ignores clicks (forces the Enter fallback)
 *   blockTyping  undo browser-generated typing (execCommand) → forces the DOM fallback
 *   emailBanner  an email field (newsletter banner) shown before the editor mounts
 *   staleAttachment  the composer already holds an attachment from an earlier draft
 *
 * Conversation knobs (step 9, reading Claude's answers), markup modelled on
 * public descriptions of claude.ai (virtualised rows with data-index,
 * data-is-streaming, .font-claude-response, .standard-markdown, action bar
 * role="group" aria-label="Message actions" with data-testid="action-bar-copy"):
 *   conversation  render an existing exchange (user brief + rich answer)
 *   streaming     the last answer is still being written (stop button shown);
 *                 finishes after `streamMs` (omit to stream forever)
 *   noActionBar   answers without action bar (button falls back into the answer)
 *   autoReply     after each sent message, Claude "answers" after `replyMs`
 */

import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

const cfg = window.__FIXTURE__ || {};
const LARGE_PASTE = 4000;
const attachments = [];
let editor;

/** Messages "sent", readable by tests from the main world. */
window.__sent = [];

const $ = (sel) => document.querySelector(sel);

function canSend() {
  return Boolean(editor) && (!editor.isEmpty || attachments.length > 0);
}

function refreshButton() {
  $('#send').disabled = !canSend();
}

function addAttachment(text) {
  attachments.push(text);
  const chip = document.createElement('div');
  chip.className = 'attachment';
  chip.textContent = `Texte collé (${text.length} caractères)`;
  $('#attachments').append(chip);
  refreshButton();
}

// ---- Conversation (rows of a virtualised list) -------------------------------

let rowIndex = 0;

const RICH_ANSWER =
  '<div class="standard-markdown grid gap-2.5"><p class="whitespace-normal">Je crée la frame dans <strong>Figma</strong>.</p></div>' +
  '<div class="tool-use"><button type="button" aria-expanded="false">Figma : use_figma</button></div>' +
  '<div class="thinking"><button type="button" aria-expanded="false">Réflexion</button>' +
  '<div style="display:none"><div class="standard-markdown"><p>Pensée cachée</p></div></div></div>' +
  '<div class="standard-markdown grid gap-2.5"><h2>Résultat</h2><ul><li>Frame <code>IA · Hello</code> créée</li><li>Texte « Hello » centré</li></ul>' +
  '<pre class="font-styrene"><div class="relative flex flex-col"><div class="text-text-300 absolute">javascript</div>' +
  '<div class="sticky"><button type="button">Copier</button></div>' +
  '<div><pre class="code-block__code"><code class="language-javascript">const frame = figma.createFrame();\nframe.name = "IA · Hello";</code></pre></div></div></pre>' +
  '<p>Lien : <a href="https://www.figma.com/design/abc">fichier</a></p></div>' +
  '<div data-testid="artifact-block" class="artifact-block-cell"><div>Spécification de la frame</div><div>Document</div></div>';

function row(html) {
  const el = document.createElement('div');
  el.dataset.index = String(rowIndex++);
  el.innerHTML = html;
  $('#thread').append(el);
  return el;
}

function userRow(text) {
  return row(`<div class="mb-1"><div data-testid="user-message"><p class="whitespace-pre-wrap">${text}</p></div></div>`);
}

function answerRow(html, { streaming = false } = {}) {
  const bar = cfg.noActionBar
    ? ''
    : '<div role="group" aria-label="Message actions" class="flex"><button type="button" data-testid="action-bar-copy" aria-label="Copier">⧉</button>' +
      '<button type="button" data-testid="action-bar-retry" aria-label="Réessayer">↻</button></div>';
  const el = row(
    `<div data-is-streaming="${streaming}" class="group relative"><div class="font-claude-response">${html}</div></div>` +
      (streaming ? '' : bar),
  );
  if (streaming) setStop(true);
  return el;
}

/** Finishes a streaming answer: final content, action bar, no stop button. */
function finish(el, html) {
  const answer = el.querySelector('[data-is-streaming]');
  answer.querySelector('.font-claude-response').innerHTML = html;
  answer.dataset.isStreaming = 'false';
  if (!cfg.noActionBar) {
    el.insertAdjacentHTML('beforeend', '<div role="group" aria-label="Message actions"><button type="button" data-testid="action-bar-copy" aria-label="Copier">⧉</button></div>');
  }
  setStop(false);
}

function setStop(on) {
  $('#stop')?.remove();
  if (on) $('#send').insertAdjacentHTML('beforebegin', '<button id="stop" type="button" aria-label="Stop response">■</button>');
}

function renderConversation() {
  userRow('/figma écris Hello dans cette frame');
  if (cfg.streaming) {
    const el = answerRow('<div class="standard-markdown"><p>Je crée la fr</p></div>', { streaming: true });
    if (cfg.streamMs) setTimeout(() => finish(el, RICH_ANSWER), cfg.streamMs);
  } else {
    answerRow(RICH_ANSWER);
  }
}

function autoReply(text) {
  const el = answerRow('<div class="standard-markdown"><p>…</p></div>', { streaming: true });
  setTimeout(
    () => finish(el, `<div class="standard-markdown"><p>Fait : ${text.split('\n')[0].slice(0, 60)}</p><p>Résultat prêt.</p></div>`),
    cfg.replyMs ?? 300,
  );
}

function send() {
  if (!canSend()) return;
  if (cfg.rateLimited) {
    $('#banner').textContent = "Vous avez atteint votre limite d'utilisation. Réessayez plus tard.";
    return;
  }
  const text = [editor.getText({ blockSeparator: '\n' }), ...attachments].filter(Boolean).join('\n');
  window.__sent.push(text);
  userRow('');
  $('#thread').lastElementChild.querySelector('p').textContent = text;
  if (cfg.autoReply) autoReply(text);

  editor.commands.clearContent(true);
  attachments.length = 0;
  $('#attachments').replaceChildren();
  if (!location.pathname.startsWith('/chat/')) history.pushState({}, '', `/chat/${Date.now()}`);
  refreshButton();
}

const EnterToSend = Extension.create({
  name: 'enterToSend',
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        send();
        return true;
      },
    };
  },
});

function mount() {
  editor = new Editor({
    element: $('#editor-host'),
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Comment puis-je vous aider aujourd’hui ?' }),
      EnterToSend,
    ],
    content: cfg.draft ? `<p>${cfg.draft}</p>` : '',
    // Keep pasted Markdown literal (no **bold** → <strong> conversion), so
    // getText() returns exactly what was pasted.
    enablePasteRules: false,
    editorProps: {
      attributes: { translate: 'no' },
      handlePaste(view, event) {
        if (cfg.ignorePaste) return true;
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (text.length > LARGE_PASTE) {
          addAttachment(text);
          return true;
        }
        return false;
      },
    },
    onUpdate: refreshButton,
    onCreate: refreshButton,
  });
  if (!cfg.brokenButton) $('#send').addEventListener('click', send);
  if (cfg.blockTyping) {
    // execCommand produces trusted "input" events; undo whatever they typed.
    editor.view.dom.addEventListener('input', (event) => {
      if (event.isTrusted) setTimeout(() => editor.commands.clearContent(true), 0);
    });
  }
}

if (cfg.conversation) renderConversation();

if (cfg.emailBanner) {
  const banner = document.createElement('input');
  Object.assign(banner, { type: 'email', placeholder: 'Recevoir la newsletter' });
  document.body.prepend(banner);
}
if (!cfg.noEditor) {
  setTimeout(() => {
    mount();
    if (cfg.staleAttachment) addAttachment('ancien texte collé '.repeat(300));
  }, cfg.mountDelay ?? 0);
}

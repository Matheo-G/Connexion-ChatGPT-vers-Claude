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

function send() {
  if (!canSend()) return;
  if (cfg.rateLimited) {
    $('#banner').textContent = "Vous avez atteint votre limite d'utilisation. Réessayez plus tard.";
    return;
  }
  const text = [editor.getText({ blockSeparator: '\n' }), ...attachments].filter(Boolean).join('\n');
  window.__sent.push(text);
  const li = document.createElement('li');
  li.textContent = text;
  $('#messages').append(li);

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

if (!cfg.noEditor) setTimeout(mount, cfg.mountDelay ?? 0);

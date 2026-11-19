/**
 * Stand-in for ChatGPT's composer (step 9: ChatGPT receives Claude's
 * results), on the same editor stack as chatgpt.com: a ProseMirror editor
 * `#prompt-textarea` in the composer form. Bundled by the e2e harness.
 *
 * Mimics: send button enabled only with content (the same button turns into
 * "stop" while ChatGPT answers, see chatgpt.html), Enter sends, very long
 * pastes become an attachment.
 * Messages "sent" are readable by tests as window.__sent.
 */

import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

const LARGE_PASTE = 4000;
const attachments = [];
window.__sent = [];

const $ = (sel) => document.querySelector(sel);
const button = () => $('#composer-button');
/** The shared button currently means "stop" (ChatGPT is answering). */
const isStop = () => button().dataset.testid === 'stop-button' || /arrêter/i.test(button().getAttribute('aria-label'));

const canSend = () => !editor.isEmpty || attachments.length > 0;

function refreshButton() {
  button().disabled = !isStop() && !canSend();
}

function send() {
  if (isStop() || !canSend()) return;
  window.__sent.push([editor.getText({ blockSeparator: '\n' }), ...attachments].filter(Boolean).join('\n'));
  editor.commands.clearContent(true);
  attachments.length = 0;
  $('#chatgpt-attachments').replaceChildren();
  refreshButton();
}

const EnterToSend = Extension.create({
  name: 'enterToSend',
  addKeyboardShortcuts: () => ({
    Enter: () => {
      send();
      return true;
    },
  }),
});

const host = $('#prompt-textarea');
const container = document.createElement('div');
container.id = 'chatgpt-attachments';
host.before(container);
host.removeAttribute('contenteditable');
host.removeAttribute('id');

const editor = new Editor({
  element: host,
  extensions: [StarterKit, EnterToSend],
  enablePasteRules: false,
  editorProps: {
    attributes: { id: 'prompt-textarea', translate: 'no' },
    handlePaste(view, event) {
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (text.length <= LARGE_PASTE) return false;
      attachments.push(text);
      container.textContent = `Texte collé (${text.length} caractères)`;
      refreshButton();
      return true;
    },
  },
  onUpdate: refreshButton,
});

button().addEventListener('click', send);
new MutationObserver(refreshButton).observe(button(), { attributes: true, attributeFilter: ['aria-label', 'data-testid'] });
refreshButton();

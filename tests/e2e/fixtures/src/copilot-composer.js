/**
 * Stand-in for the Microsoft 365 Copilot Chat composer (copilot.cloud.microsoft),
 * built on the same editor framework as the real one: Lexical. Like the real
 * site, it ignores direct DOM edits (Lexical reconciles them away) and only
 * accepts a paste. Bundled by the e2e harness.
 *
 * Knobs (window.__FIXTURE__): mountDelay (ms), noEditor.
 */

import { createEditor, $getRoot, KEY_ENTER_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical';
import { registerRichText } from '@lexical/rich-text';

const cfg = window.__FIXTURE__ || {};
window.__sent = [];
let editor;
let text = '';

const $ = (sel) => document.querySelector(sel);

function refreshButton() {
  $('#send').disabled = !text.trim();
}

function send() {
  if (!text.trim()) return;
  window.__sent.push(text);
  const li = document.createElement('li');
  li.className = 'fai-CopilotMessage';
  li.textContent = text;
  $('#messages').append(li);
  editor.update(() => $getRoot().clear());
  if (!location.pathname.includes('/conversation/')) history.pushState({}, '', `/chat/conversation/${Date.now()}`);
}

function mount() {
  const root = $('#m365-chat-editor-target-element');
  root.contentEditable = 'true';
  editor = createEditor({ namespace: 'copilot-fixture', onError: (error) => console.error(error) });
  editor.setRootElement(root);
  registerRichText(editor);
  editor.registerCommand(
    KEY_ENTER_COMMAND,
    (event) => {
      if (event?.shiftKey) return false;
      event?.preventDefault();
      send();
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );
  editor.registerUpdateListener(({ editorState }) => {
    text = editorState.read(() => $getRoot().getTextContent());
    refreshButton();
  });
  $('#send').addEventListener('click', send);
}

if (!cfg.noEditor) setTimeout(mount, cfg.mountDelay ?? 0);

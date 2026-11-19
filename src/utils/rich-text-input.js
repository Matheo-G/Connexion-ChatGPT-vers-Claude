/**
 * @file Reliable text insertion into rich-text editors (ProseMirror, Tiptap,
 * Lexical, Quill…). Content-script side only.
 *
 * The problem: these editors keep their own document model. Setting
 * `innerText` changes the DOM but not the model, so the site ignores the
 * text and its send button stays disabled.
 *
 * The solution: emulate what a human does, from the most faithful to the
 * most brutal, and VERIFY after each attempt (the adapter tells us how):
 *   1. paste     – synthetic ClipboardEvent: handled natively by the editor,
 *                  keeps line breaks, triggers the site's own paste logic
 *                  (e.g. Claude turns very long pastes into an attachment);
 *   2. execCommand('insertText') – emulates typing, whole text at once: no
 *                  'insertParagraph', which editors binding Enter to "send"
 *                  could treat as a key press and submit after line 1;
 *   3. dom       – rewrites the paragraphs + "input" event; the editor's
 *                  MutationObserver picks the change up.
 */

import { RouterError, ErrorCode } from '../shared/errors.js';
import { sleep } from './async.js';
import { focusAtEnd, waitForCondition } from './dom.js';

const VERIFY_TIMEOUT = 1_500;
const SETTLE_DELAY = 30;
/**
 * Some editors accept an input then revert it asynchronously (controlled
 * components, validation). Wait a little before trusting the result.
 */
const STABILIZE_DELAY = 150;

/** @type {ReadonlyArray<{name: string, run: (editor: HTMLElement, text: string) => void}>} */
const STRATEGIES = Object.freeze([
  { name: 'paste', run: pasteText },
  { name: 'execCommand', run: typeText },
  { name: 'dom', run: writeParagraphs },
]);

/**
 * Replaces the editor content with `text`.
 * @param {() => HTMLElement} getEditor  Returns the CURRENT editor element
 *   (sites may re-render it between attempts).
 * @param {string} text
 * @param {{isInserted: () => boolean, log: {debug: Function, warn: Function}}} options
 * @returns {Promise<string>} Name of the strategy that worked.
 */
export async function insertIntoEditor(getEditor, text, { isInserted, log }) {
  for (const strategy of STRATEGIES) {
    const editor = getEditor();
    await clearEditor(editor);
    try {
      strategy.run(editor, text);
    } catch (error) {
      log.debug(`Strategy "${strategy.name}" threw`, error);
    }
    await sleep(STABILIZE_DELAY);
    if (await waitForCondition(isInserted, { timeout: VERIFY_TIMEOUT })) {
      log.debug(`Text inserted with "${strategy.name}"`);
      return strategy.name;
    }
    log.warn(`Strategy "${strategy.name}" had no effect, trying the next one`);
  }
  throw new RouterError(ErrorCode.INSERT_FAILED, 'All insertion strategies failed');
}

/**
 * Empties the editor through its own model when possible.
 * @param {HTMLElement} editor
 */
export async function clearEditor(editor) {
  focusAtEnd(editor);
  await sleep(SETTLE_DELAY); // let the editor sync its selection
  if (!editor.textContent.trim()) return;

  document.execCommand('selectAll');
  document.execCommand('delete');
  await sleep(SETTLE_DELAY);
  if (editor.textContent.trim()) {
    editor.replaceChildren(paragraph(''));
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
  }
  focusAtEnd(editor);
}

// ---- Strategies ----------------------------------------------------------

function pasteText(editor, text) {
  const data = new DataTransfer();
  data.setData('text/plain', text);
  editor.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  );
}

function typeText(editor, text) {
  focusAtEnd(editor);
  document.execCommand('insertText', false, text);
}

function writeParagraphs(editor, text) {
  editor.replaceChildren(...text.split(/\r?\n/).map(paragraph));
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
}

function paragraph(line) {
  const p = document.createElement('p');
  if (line) p.textContent = line;
  else p.append(document.createElement('br'));
  return p;
}

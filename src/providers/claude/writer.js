/**
 * @file Writes a message into Claude and sends it.
 *
 *   1. refuse early on the login screen (TARGET_NOT_LOGGED_IN);
 *   2. wait for the editor to be mounted (the app hydrates after "load");
 *   3. insert the text (rich-text-input strategies + verification);
 *   4. optionally send: click the send button, fall back to Enter, and
 *      verify the message actually left (URL change, editor emptied or send
 *      button gone). Distinguish a usage-limit banner from a generic failure.
 */

import { RouterError, ErrorCode } from '../../shared/errors.js';
import { Timeouts } from '../../shared/defaults.js';
import { queryFirst, waitForElement, waitForCondition, isEnabled } from '../../utils/dom.js';
import { insertIntoEditor } from '../../utils/rich-text-input.js';
import { normalizeText, fingerprint, hasText } from '../../utils/text.js';
import { SELECTORS, AUTH_PATHS, RATE_LIMIT_PATTERNS } from './selectors.js';

const SEND_BUTTON_WAIT = 5_000;
const SENT_CONFIRM_WAIT = 4_000;

// ---- Page state ---------------------------------------------------------

export function isAuthPage() {
  if (AUTH_PATHS.some((path) => location.pathname.startsWith(path))) return true;
  return !findEditor() && Boolean(queryFirst(SELECTORS.loginForm));
}

/** @returns {HTMLElement | null} */
export function findEditor() {
  return /** @type {HTMLElement} */ (queryFirst(SELECTORS.editor)?.element ?? null);
}

function findComposer(editor) {
  return SELECTORS.composer.map((s) => editor?.closest(s)).find(Boolean) ?? null;
}

/** Send button, looked up inside the composer first to avoid look-alikes. */
export function findSendButton() {
  const composer = findComposer(findEditor());
  const inComposer = composer && queryFirst(SELECTORS.sendButton, { root: composer });
  return /** @type {HTMLButtonElement} */ ((inComposer || queryFirst(SELECTORS.sendButton))?.element ?? null);
}

function editorText() {
  return findEditor()?.innerText ?? '';
}

function isRateLimited() {
  const area = findComposer(findEditor())?.parentElement ?? document.body;
  const text = area?.innerText ?? '';
  return RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(text));
}

// ---- Steps --------------------------------------------------------------

async function waitForEditor() {
  if (isAuthPage()) throw new RouterError(ErrorCode.TARGET_NOT_LOGGED_IN, location.pathname);

  const { selector } = await waitForElement([...SELECTORS.editor, ...SELECTORS.loginForm], {
    timeout: Timeouts.ELEMENT,
    code: ErrorCode.EDITOR_NOT_FOUND,
  });
  if (SELECTORS.loginForm.includes(selector)) {
    throw new RouterError(ErrorCode.TARGET_NOT_LOGGED_IN, 'Login form displayed');
  }
}

/**
 * Inserted = our text is visible in the editor, OR Claude converted the paste
 * into an attachment (editor stays empty but the send button turns on).
 */
function isInserted(text) {
  const probe = fingerprint(text);
  return () =>
    fingerprint(editorText(), Infinity).includes(probe) ||
    (!hasText(editorText()) && isEnabled(findSendButton()));
}

async function send(log) {
  const before = { url: location.href, hadText: hasText(editorText()) };

  const button = await waitForCondition(() => {
    const candidate = findSendButton();
    return isEnabled(candidate) && candidate;
  }, { timeout: SEND_BUTTON_WAIT });

  if (button) {
    button.click();
    if (await wasSent(before, true)) return 'button';
    log.warn('Click on send button had no visible effect, trying Enter');
  }

  pressEnter(findEditor());
  if (await wasSent(before, Boolean(button))) return 'enter';

  if (isRateLimited()) throw new RouterError(ErrorCode.TARGET_RATE_LIMITED, 'Usage limit banner');
  throw new RouterError(ErrorCode.SEND_FAILED, 'Message still in the composer', {
    buttonFound: Boolean(button),
  });
}

function wasSent(before, buttonWasEnabled) {
  return waitForCondition(
    () =>
      location.href !== before.url ||
      (before.hadText && !hasText(editorText())) ||
      (buttonWasEnabled && !isEnabled(findSendButton())),
    { timeout: SENT_CONFIRM_WAIT },
  );
}

function pressEnter(editor) {
  editor?.focus();
  editor?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    }),
  );
}

// ---- Public API ---------------------------------------------------------

/**
 * @param {{text: string, autoSend?: boolean}} payload
 * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
 * @returns {Promise<{insertedWith: string, sent: boolean, sentWith?: string, url: string}>}
 */
export async function submit({ text, autoSend = true }, { log }) {
  if (!hasText(text)) throw new RouterError(ErrorCode.NO_CONTENT, 'Empty text');

  await waitForEditor();
  const insertedWith = await insertIntoEditor(findEditor, text, { isInserted: isInserted(text), log });
  log.info(`Text inserted (${insertedWith}, ${normalizeText(text).length} chars)`);

  if (!autoSend) return { insertedWith, sent: false, url: location.href };

  const sentWith = await send(log);
  log.info(`Message sent (${sentWith})`);
  return { insertedWith, sent: true, sentWith, url: location.href };
}

/** Lightweight state report, used by PING and the popup. */
export function health() {
  return {
    loggedIn: !isAuthPage(),
    editorFound: Boolean(findEditor()),
    sendButtonFound: Boolean(findSendButton()),
  };
}

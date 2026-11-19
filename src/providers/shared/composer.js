/**
 * @file Generic "chat composer" target: everything needed to write a message
 * into an AI chat page and send it, configured by the site's selectors only.
 * Claude and Copilot are two configurations of this module; a new target
 * AI usually needs nothing else (see docs/ADD_A_PROVIDER.md).
 *
 *   1. refuse early on the login screen (TARGET_NOT_LOGGED_IN);
 *   2. wait for the editor to be mounted (apps hydrate after "load");
 *   3. insert the text (rich-text-input strategies + verification);
 *   4. optionally send: click the send button, fall back to Enter, and
 *      verify the message actually left (URL change, editor emptied or send
 *      button gone). Distinguish a usage-limit banner from a generic failure.
 */

import { MessageType } from '../../shared/message-types.js';
import { RouterError, ErrorCode } from '../../shared/errors.js';
import { Timeouts } from '../../shared/defaults.js';
import { queryFirst, waitForElement, waitForCondition, isEnabled } from '../../utils/dom.js';
import { insertIntoEditor, clearEditor } from '../../utils/rich-text-input.js';
import { normalizeText, fingerprint, hasText } from '../../utils/text.js';
import { domSkeleton } from '../../utils/dom-skeleton.js';

const SEND_BUTTON_WAIT = 5_000;
/** An email field seen before the editor may be a banner, not the login page. */
const LOGIN_GRACE = 3_000;
const SENT_CONFIRM_WAIT = 4_000;

/**
 * @typedef {Object} ComposerConfig
 * @property {string} name                      Display name ("Claude").
 * @property {{editor: string[], sendButton: string[], composer: string[], loginForm: string[]}} selectors
 * @property {readonly string[]} authPaths      URL paths of the login screens on the site itself.
 * @property {readonly RegExp[]} rateLimitPatterns  Usage-limit banners, searched around the composer.
 * @property {RegExp} chatPages                 Paths that must show an editor (health check).
 */

/**
 * @param {ComposerConfig} config
 */
export function createComposerWriter({ selectors, authPaths, rateLimitPatterns, chatPages }) {
  // ---- Page state ---------------------------------------------------------

  const onAuthPath = () => authPaths.some((path) => location.pathname.startsWith(path));

  function isAuthPage() {
    if (onAuthPath()) return true;
    return !findEditor() && Boolean(queryFirst(selectors.loginForm));
  }

  /** @returns {HTMLElement | null} */
  function findEditor() {
    return /** @type {HTMLElement} */ (queryFirst(selectors.editor)?.element ?? null);
  }

  function findComposer(editor) {
    return selectors.composer.map((s) => editor?.closest(s)).find(Boolean) ?? null;
  }

  /** Send button, looked up inside the composer first to avoid look-alikes. */
  function findSendButton() {
    const composer = findComposer(findEditor());
    const inComposer = composer && queryFirst(selectors.sendButton, { root: composer });
    return /** @type {HTMLButtonElement} */ ((inComposer || queryFirst(selectors.sendButton))?.element ?? null);
  }

  const editorText = () => findEditor()?.innerText ?? '';

  function isRateLimited() {
    const area = findComposer(findEditor())?.parentElement ?? document.body;
    const text = area?.innerText ?? '';
    return rateLimitPatterns.some((pattern) => pattern.test(text));
  }

  // ---- Steps --------------------------------------------------------------

  async function waitForEditor(timeout = Timeouts.ELEMENT) {
    // Only the URL is conclusive here; a login-looking field gets a grace period below.
    if (onAuthPath()) throw new RouterError(ErrorCode.TARGET_NOT_LOGGED_IN, location.pathname);

    const { selector } = await waitForElement([...selectors.editor, ...selectors.loginForm], {
      timeout,
      code: ErrorCode.EDITOR_NOT_FOUND,
    });
    if (selectors.loginForm.includes(selector)) {
      // Outside the auth pages, give the editor a moment: the field may be a banner or dialog.
      const editor = await waitForElement(selectors.editor, { timeout: LOGIN_GRACE }).catch(() => null);
      if (!editor) throw new RouterError(ErrorCode.TARGET_NOT_LOGGED_IN, 'Login form displayed');
    }
  }

  /**
   * Inserted = our text is visible in the editor, OR the site converted the
   * paste into an attachment (editor stays empty but the send button turns
   * on). The attachment signal is ignored when the composer already held an
   * attachment before insertion (`staleAttachment`): it would prove nothing.
   */
  function isInserted(text, { staleAttachment }) {
    const probe = fingerprint(text);
    return () =>
      fingerprint(editorText(), Infinity).includes(probe) ||
      (!staleAttachment && !hasText(editorText()) && isEnabled(findSendButton()));
  }

  /** Empty composer whose send button is on: something (an attachment) is already there. */
  async function detectStaleAttachment(log) {
    await clearEditor(findEditor());
    const stale = !hasText(editorText()) && isEnabled(findSendButton());
    if (stale) log.warn('The composer already holds an attachment: it will be sent along');
    return stale;
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

  // ---- Public API -----------------------------------------------------------

  /**
   * @param {{text: string, autoSend?: boolean, elementTimeout?: number}} payload
   * @param {{log: ReturnType<import('../../utils/logger.js').createLogger>}} context
   * @returns {Promise<{insertedWith: string, sent: boolean, sentWith?: string, url: string}>}
   */
  async function submit({ text, autoSend = true, elementTimeout }, { log }) {
    if (!hasText(text)) throw new RouterError(ErrorCode.NO_CONTENT, 'Empty text');

    await waitForEditor(elementTimeout);
    const staleAttachment = await detectStaleAttachment(log);
    const insertedWith = await insertIntoEditor(findEditor, text, {
      isInserted: isInserted(text, { staleAttachment }),
      log,
    });
    log.info(`Text inserted (${insertedWith}, ${normalizeText(text).length} chars)`);

    if (!autoSend) return { insertedWith, sent: false, url: location.href };

    const sentWith = await send(log);
    log.info(`Message sent (${sentWith})`);
    return { insertedWith, sent: true, sentWith, url: location.href };
  }

  /**
   * Lightweight state report, used by PING and the popup. `recognized` is
   * false when a logged-in chat page has no editor we can find: the site has
   * probably changed its page (see its selectors.js).
   */
  function health() {
    const loggedIn = !isAuthPage();
    const editorFound = Boolean(findEditor());
    return {
      loggedIn,
      editorFound,
      sendButtonFound: Boolean(findSendButton()),
      recognized: !loggedIn || !chatPages.test(location.pathname) || editorFound || document.readyState !== 'complete',
    };
  }

  return { submit, health, findEditor };
}

function pressEnter(editor) {
  editor?.focus();
  editor?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }),
  );
}

/**
 * Anonymous diagnostic of a composer page (no conversation text): markers
 * found, frames (an editor inside an iframe would be out of reach), and the
 * skeleton of the composer.
 * @param {ComposerConfig} config
 * @param {ReturnType<typeof createComposerWriter>} writer
 * @returns {{text: string}}
 */
function snapshot({ name, selectors, authPaths }, writer) {
  const { version } = chrome.runtime.getManifest();
  const all = [...selectors.editor, ...selectors.sendButton, ...selectors.composer, ...selectors.loginForm];
  const counts = [...new Set(all)].map((s) => `${String(document.querySelectorAll(s).length).padStart(3)}   ${s}`);
  const frames = [...document.querySelectorAll('iframe')].map((frame) => {
    try {
      return new URL(frame.src, location.href).origin;
    } catch {
      return '(sans adresse)';
    }
  });
  const editor = writer.findEditor();
  const composer =
    selectors.composer.map((s) => editor?.closest(s)).find(Boolean) ?? document.querySelector(selectors.composer.join(','));
  const state = writer.health();
  const onAuth = authPaths.some((p) => location.pathname.startsWith(p));
  const text = [
    `Mathéo AI Router ${version} — diagnostic ${name} (sans contenu de conversation)`,
    `Page : ${location.host}${location.pathname.replace(/[0-9a-f-]{16,}/gi, ':id')}${onAuth ? ' (connexion)' : ''}`,
    `Connecté : ${state.loggedIn} — éditeur : ${state.editorFound} — bouton d'envoi : ${state.sendButtonFound}`,
    `### Marqueurs\n${counts.join('\n')}`,
    `### Cadres (iframes) : ${frames.length}\n${[...new Set(frames)].join('\n') || '(aucun)'}`,
    `### Zone de saisie\n${composer ? domSkeleton(composer, { maxDepth: 12, maxNodes: 250 }) : '(none)'}`,
  ].join('\n\n');
  return { text };
}

/**
 * Content-runtime adapter for a composer target (see content/runtime.js).
 * @param {ComposerConfig} config
 */
export function createComposerAdapter(config) {
  const writer = createComposerWriter(config);
  return ({ log }) => ({
    describe: () => ({ path: location.pathname, ...writer.health() }),
    handlers: {
      [MessageType.TARGET_SUBMIT]: (payload) => writer.submit(payload, { log }),
      [MessageType.PROVIDER_DIAGNOSE]: () => snapshot(config, writer),
    },
    destroy() {},
  });
}

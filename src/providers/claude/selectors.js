/**
 * @file Every claude.ai DOM assumption, in one place.
 *
 * When Claude changes its UI, this is normally the only file to update.
 * Each list is ordered from most specific/stable to most generic.
 *
 * Observed structure (Nov. 2026, French UI):
 *   <div contenteditable="true" translate="no" class="tiptap ProseMirror">
 *     <p data-placeholder="Comment puis-je vous aider aujourd’hui ?" class="is-empty is-editor-empty">
 *       <br class="ProseMirror-trailingBreak">
 *     </p>
 *   </div>
 * The send button's aria-label is localized ("Send message" / French label).
 */

export const SELECTORS = Object.freeze({
  /** Rich-text editor (Tiptap/ProseMirror). */
  editor: [
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][translate="no"]',
    'fieldset [contenteditable="true"]',
    'main [contenteditable="true"]',
  ],

  /** Send button — searched inside the composer first, then the page. */
  sendButton: [
    'button[aria-label="Send message"]',
    'button[aria-label="Envoyer le message"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="envoyer" i]',
    'button[type="submit"]',
  ],

  /** Container holding the editor and its buttons. */
  composer: ['fieldset', 'form'],

  /** Elements that only exist on the login / signup screens. */
  loginForm: ['input[type="email"]', 'button[data-testid="login-with-google"]'],
});

/** URL paths of the authentication screens. */
export const AUTH_PATHS = Object.freeze(['/login', '/signup', '/logout', '/magic-link']);

/** Usage-limit banners (EN/FR). Searched only around the composer. */
export const RATE_LIMIT_PATTERNS = Object.freeze([
  /usage limit/i,
  /message limit/i,
  /out of (free )?messages/i,
  /limite d.utilisation/i,
  /limite de messages/i,
  /plus de messages/i,
]);

/**
 * Reading Claude's answers (step 9: "↩ ChatGPT"). Sources: public exporters
 * and extensions for claude.ai (2025-2026), to be confirmed with the popup's
 * diagnostic on a real conversation.
 *
 *   <div data-index="3">                               ← virtualised row (stable index)
 *     <div data-is-streaming="false">                  ← one answer ("true" while writing)
 *       <div class="font-claude-response">
 *         <div class="standard-markdown">…</div>       ← text before a tool call
 *         <div>(tool call: button "Figma …")</div>
 *         <div class="standard-markdown">…</div>       ← text after it
 *     <div role="group" aria-label="Message actions">  ← copy, retry…
 *       <button data-testid="action-bar-copy">
 *   <div data-testid="user-message">                   ← the user's messages
 */
export const READER = Object.freeze({
  /** One answer block (ordered fallbacks: the first selector matching anything wins). */
  reply: ['[data-is-streaming]', '.font-claude-response', '.font-claude-message', '[data-testid="assistant-message"]'],

  /** The user's messages. */
  prompt: ['[data-testid="user-message"]'],

  /** Row of the virtualised list: its index is a stable id for the answer. */
  row: '[data-index], [data-rs-index]',
  rowIdAttributes: ['data-index', 'data-rs-index'],

  /** Rendered Markdown inside an answer (several around tool calls); else the whole answer. */
  content: ['.standard-markdown', '.progressive-markdown', '.font-claude-response-body'],

  /** Present while Claude writes. */
  streaming: ['[data-is-streaming="true"]'],
  stopButton: [
    'fieldset button[aria-label="Stop response"]',
    'fieldset button[aria-label*="Arrêter" i]',
    'fieldset button[aria-label*="stop" i]',
  ],

  /** Action bar under an answer: the "↩ ChatGPT" button is appended to it. */
  actionBar: [
    '[role="group"][aria-label="Message actions"]',
    '[role="group"]:has(> button[data-testid="action-bar-copy"])',
    'div:has(> button[data-testid="action-bar-copy"])',
  ],

  /** Artifact cards (documents/code opened in the side panel): only their title is in the message. */
  artifact: ['[data-testid*="artifact" i]', '.artifact-block-cell'],

  /** Site UI living inside answers, never part of the text. */
  ignoreInContent: ['[data-testid*="artifact" i]', '.artifact-block-cell', '[role="group"]', '[aria-hidden="true"]'],
});

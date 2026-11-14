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

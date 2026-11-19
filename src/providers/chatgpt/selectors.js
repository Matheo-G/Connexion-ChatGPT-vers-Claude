/**
 * @file Every chatgpt.com DOM assumption, in one place.
 *
 * ChatGPT serves different layouts per account, and rolls new ones out
 * gradually. The reader tries each LAYOUT in order and uses the first one
 * that finds a rendered answer, so old and new layouts both keep working.
 * When ChatGPT changes again, add a layout here (the popup's "diagnostic"
 * button gives the markers to use).
 */

/**
 * @typedef {Object} ChatLayout
 * @property {string} name
 * @property {string} turn        One exchange (prompt and/or answer).
 * @property {string[]} reply     One assistant answer block (ordered fallbacks).
 * @property {string[]} prompt    One user prompt block (ordered fallbacks).
 * @property {string[]} replyIdAttributes  Attributes holding the answer's id, by preference
 *   (one per reply selector, so a fallback selector still yields an id).
 * @property {string[]} content   Rendered Markdown inside an answer; else the answer itself.
 */

/** @type {readonly ChatLayout[]} */
export const LAYOUTS = Object.freeze([
  {
    // "Chat / Work" layout rolled out per account from Sept. 2026.
    name: 'turn-key',
    turn: '[data-turn-key]',
    reply: ['[data-chatgpt-selection-message-id]', '[data-content-search-unit-key$=":assistant"]'],
    prompt: ['[data-user-message-bubble="true"]', '[data-content-search-unit-key$=":user"]'],
    replyIdAttributes: ['data-chatgpt-selection-message-id', 'data-chatgpt-search-message-ids'],
    content: ['[data-markdown-text-style="assistant-message"]', '.markdown', '.prose'],
  },
  {
    // Classic layout (still served to some accounts and logged-out users).
    name: 'author-role',
    turn: '[data-testid^="conversation-turn-"]',
    reply: ['[data-message-author-role="assistant"]'],
    prompt: ['[data-message-author-role="user"]'],
    replyIdAttributes: ['data-message-id'],
    content: ['.markdown', '.prose', '[class*="markdown"]'],
  },
]);

export const SELECTORS = Object.freeze({
  /**
   * Present while ChatGPT is writing. Generic fallbacks are scoped to the
   * composer form, so a "stop reading aloud" button elsewhere cannot block us.
   */
  stopButton: [
    'button[data-testid="stop-button"]',
    'form button[aria-label*="stop" i]',
    'form button[aria-label*="arrêter" i]',
  ],

  /** Streaming markers on the answer being written (layout-dependent). */
  streamingMarker: ['.result-streaming', '.streaming-animation'],

  /**
   * Turn-key layout: each turn declares its state ("complete" when done).
   * Any other value on the newest turn means ChatGPT is still working.
   */
  turnState: Object.freeze({
    selector: '[data-talvt-turn-state]',
    attribute: 'data-talvt-turn-state',
    finished: /^(complete|completed|done|error|failed|stopped|cancell?ed|aborted)$/i,
  }),

  /**
   * Action bar under an answer (copy, rate, read aloud…), searched inside the
   * answer's turn. The "Send to Claude" button is appended to it.
   */
  actionBar: [
    '.turn-action-controls > div:has(> button)',
    '.turn-action-controls',
    'div:has(> button[data-testid="copy-turn-action-button"])',
  ],

  /** Code blocks rendered without <pre> (turn-key layout). */
  codeBlocks: ['[data-code-block="true"]'],

  /** The language label in a code block header. */
  codeLanguageLabels: ['[data-markdown-copy="exclude"] .truncate', '[data-markdown-copy="exclude"] div'],

  /** Site UI living inside answers, never part of the text. */
  ignoreInContent: [
    '[data-markdown-copy="exclude"]',
    '[data-testid="webpage-citation-pill"]',
    '[data-testid$="-turn-action-button"]',
    '.turn-action-controls',
    'h1[data-conversation-role], h2[data-conversation-role], h3[data-conversation-role], h4[data-conversation-role], h5[data-conversation-role], h6[data-conversation-role]',
    '.sr-only',
  ],
});

/**
 * ChatGPT as the receiver of results sent back from Claude (step 9).
 * Composer: a ProseMirror editor `#prompt-textarea` in the composer form.
 * The send and stop buttons share their place: only "send" selectors here,
 * and the writer refuses while ChatGPT is answering (never click "stop").
 */
export const COMPOSER = Object.freeze({
  editor: [
    '#prompt-textarea[contenteditable="true"]',
    'form [contenteditable="true"][role="textbox"]',
    'form .ProseMirror[contenteditable="true"]',
    'textarea#prompt-textarea',
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label*="Envoyer" i]',
    'button[aria-label*="Send" i]',
  ],
  composer: ['form', '[data-type="unified-composer"]'],
  loginForm: ['[data-testid="login-button"]', 'a[href*="/auth/login"]'],
});

export const COMPOSER_AUTH_PATHS = Object.freeze(['/auth/login', '/log-in']);

/** Usage-limit banners (EN/FR), searched around the composer. */
export const COMPOSER_RATE_LIMITS = Object.freeze([
  /usage cap/i,
  /reached (the|your) (\w+ )?limit/i,
  /limite d.utilisation/i,
  /atteint (la|votre) limite/i,
]);

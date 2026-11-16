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
 * @property {string} replyIdAttribute  Attribute holding the answer's id.
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
    replyIdAttribute: 'data-chatgpt-selection-message-id',
    content: ['.markdown', '.prose'],
  },
  {
    // Classic layout (still served to some accounts and logged-out users).
    name: 'author-role',
    turn: '[data-testid^="conversation-turn-"]',
    reply: ['[data-message-author-role="assistant"]'],
    prompt: ['[data-message-author-role="user"]'],
    replyIdAttribute: 'data-message-id',
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

  /** Site UI living inside answers, never part of the text. */
  ignoreInContent: [
    '[data-testid="webpage-citation-pill"]',
    '[data-testid$="-turn-action-button"]',
    '.turn-action-controls',
    'h1[data-conversation-role], h2[data-conversation-role], h3[data-conversation-role], h4[data-conversation-role], h5[data-conversation-role], h6[data-conversation-role]',
    '.sr-only',
  ],
});

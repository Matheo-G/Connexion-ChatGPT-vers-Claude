/**
 * @file Every chatgpt.com DOM assumption, in one place.
 *
 * When ChatGPT changes its UI, this is normally the only file to update.
 * Each list is ordered from most specific/stable to most generic.
 *
 * Expected structure (2025-2026):
 *   <article data-testid="conversation-turn-N">          ← one turn
 *     <h6 class="sr-only">ChatGPT a dit :</h6>
 *     <div data-message-author-role="assistant" data-message-id="…">
 *       <div class="markdown prose …"> rendered answer </div>
 *     </div>
 *     <div> action bar: copy, 👍, 👎, … </div>
 *   </article>
 * While an answer streams, the composer shows a stop button.
 */

export const SELECTORS = Object.freeze({
  /** One conversation turn (user or assistant). */
  turn: [
    'article[data-testid^="conversation-turn-"]',
    'section[data-testid^="conversation-turn-"]',
    '[data-testid^="conversation-turn-"]',
  ],

  /** One assistant message (a turn may hold several, e.g. around tool calls). */
  assistantMessage: ['[data-message-author-role="assistant"]'],

  /** One user message (used to find the prompt that led to an answer). */
  userMessage: ['[data-message-author-role="user"]'],

  /** Rendered Markdown inside a message. Falls back to the message itself. */
  content: ['.markdown', '.prose', '[class*="markdown"]'],

  /**
   * Present while ChatGPT is writing. Generic fallbacks are scoped to the
   * composer form, so a "stop reading aloud" button elsewhere cannot block us.
   */
  stopButton: [
    'button[data-testid="stop-button"]',
    'form button[aria-label*="stop" i]',
    'form button[aria-label*="arrêter" i]',
  ],

  /** Older streaming marker on the message being written. */
  streamingMarker: ['.result-streaming', '.streaming-animation'],

  /** Site UI living inside answers, never part of the text. */
  ignoreInContent: [
    '[data-testid="webpage-citation-pill"]',
    '[data-testid$="-turn-action-button"]',
    '.sr-only',
  ],
});

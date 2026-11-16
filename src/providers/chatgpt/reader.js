/**
 * @file Reads ChatGPT answers from the page.
 *
 *   extract()                → the latest answer (whole last assistant turn)
 *   extract({ messageId })   → one specific answer (button under each message, step 4)
 *
 * Refuses while ChatGPT is still writing (STILL_GENERATING) and when there is
 * nothing to read (NO_CONTENT). Returns Markdown plus the user prompt that
 * led to the answer (used later to detect "/figma", "/code"…).
 */

import { RouterError, ErrorCode } from '../../shared/errors.js';
import { queryFirst } from '../../utils/dom.js';
import { htmlToMarkdown } from '../../utils/html-to-markdown.js';
import { hasText } from '../../utils/text.js';
import { SELECTORS } from './selectors.js';

const everywhere = () => true; // include off-screen messages

/** @param {string[]} selectors */
function queryAll(selectors, root = document) {
  for (const selector of selectors) {
    const found = [...root.querySelectorAll(selector)];
    if (found.length) return found;
  }
  return [];
}

// ---- Page state ---------------------------------------------------------

export function isGenerating() {
  return Boolean(queryFirst(SELECTORS.stopButton) || queryFirst(SELECTORS.streamingMarker, { filter: everywhere }));
}

export function countAssistantMessages() {
  return queryAll(SELECTORS.assistantMessage).length;
}

// ---- Locating messages --------------------------------------------------

/**
 * The messages forming the answer to read: every assistant message of the
 * last assistant turn (answers may be split around tool calls), or the
 * message with the given id.
 * @returns {Element[]}
 */
function findAnswerMessages(messageId) {
  if (messageId) {
    const message = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!message) throw new RouterError(ErrorCode.NO_CONTENT, `Message ${messageId} not found`);
    return [message];
  }
  const messages = queryAll(SELECTORS.assistantMessage);
  const last = messages.at(-1);
  if (!last) return [];
  const turn = SELECTORS.turn.map((s) => last.closest(s)).find(Boolean);
  return turn ? messages.filter((m) => turn.contains(m)) : [last];
}

/** Last user message located before `message` in the page. */
function findPromptFor(message) {
  const users = queryAll(SELECTORS.userMessage).filter(
    (user) => user.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  return users.at(-1)?.textContent.trim() ?? '';
}

function toMarkdown(message) {
  const content = queryFirst(SELECTORS.content, { root: message, filter: everywhere })?.element ?? message;
  return htmlToMarkdown(content, { ignore: SELECTORS.ignoreInContent });
}

// ---- Public API ---------------------------------------------------------

/**
 * @typedef {Object} ExtractedAnswer
 * @property {string} markdown
 * @property {string} prompt      The user message that led to this answer.
 * @property {string | null} messageId
 * @property {number} length
 */

/**
 * @param {{messageId?: string}} [options]
 * @returns {ExtractedAnswer}
 */
export function extract({ messageId } = {}) {
  const messages = findAnswerMessages(messageId);
  const isLatest = !messageId || messages[0] === queryAll(SELECTORS.assistantMessage).at(-1);
  if (isLatest && isGenerating()) {
    throw new RouterError(ErrorCode.STILL_GENERATING, 'Answer still streaming');
  }

  const markdown = messages.map(toMarkdown).filter(hasText).join('\n\n');
  if (!hasText(markdown)) throw new RouterError(ErrorCode.NO_CONTENT, 'No assistant answer on the page');

  const last = messages.at(-1);
  return {
    markdown,
    prompt: findPromptFor(messages[0]),
    messageId: last.getAttribute('data-message-id'),
    length: markdown.length,
  };
}

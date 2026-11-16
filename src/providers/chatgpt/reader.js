/**
 * @file Reads ChatGPT answers from the page, whatever the layout.
 *
 *   extract()                → the latest answer (every answer block of the last exchange)
 *   extract({ messageId })   → one specific answer (button under each message, step 4)
 *
 * Robust to what ChatGPT does in practice:
 *   - several layouts (see selectors.js LAYOUTS), detected automatically;
 *   - conversations opened earlier kept in the page under `display: none`;
 *   - the thread rendered twice (duplicates are dropped by answer id).
 *
 * Refuses while ChatGPT is still writing (STILL_GENERATING) and when there is
 * nothing to read (NO_CONTENT). Returns Markdown plus the user prompt that
 * led to the answer (used later to detect "/figma", "/code"…).
 */

import { RouterError, ErrorCode } from '../../shared/errors.js';
import { queryFirst } from '../../utils/dom.js';
import { htmlToMarkdown } from '../../utils/html-to-markdown.js';
import { hasText } from '../../utils/text.js';
import { LAYOUTS, SELECTORS } from './selectors.js';

// ---- DOM helpers ----------------------------------------------------------

/**
 * Not inside a `display: none` / hidden ancestor (ChatGPT keeps earlier
 * conversations in the page that way). `display: contents` wrappers, which
 * ChatGPT uses a lot, have no box of their own but are NOT hidden — hence
 * this walk instead of Element.checkVisibility().
 */
export function isRendered(el) {
  if (!el.isConnected) return false;
  for (let node = el; node; node = node.parentElement) {
    if (node.hidden || getComputedStyle(node).display === 'none') return false;
  }
  return true;
}

/** Rendered matches of the first selector that matches anything rendered. */
function renderedMatches(selectors, root = document) {
  for (const selector of selectors) {
    const found = [...root.querySelectorAll(selector)].filter(isRendered);
    if (found.length) return found;
  }
  return [];
}

/** Drops elements nested in another match, then duplicates sharing an id. */
function uniqueBlocks(elements, idAttribute) {
  const outer = elements.filter((el) => !elements.some((o) => o !== el && o.contains(el)));
  const seen = new Set();
  return outer.filter((el) => {
    const id = el.getAttribute(idAttribute);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const precedes = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

// ---- Layout detection -------------------------------------------------------

/**
 * @returns {{layout: import('./selectors.js').ChatLayout, replies: Element[]} | null}
 *   The first layout with at least one rendered answer, and its answers in page order.
 */
function detectLayout() {
  for (const layout of LAYOUTS) {
    const replies = uniqueBlocks(renderedMatches(layout.reply), layout.replyIdAttribute);
    if (replies.length) return { layout, replies };
  }
  return null;
}

/**
 * `recognized` is false on a conversation page where no known layout finds
 * any answer: ChatGPT has probably changed its page (see selectors.js).
 */
export function describeLayout() {
  const found = detectLayout();
  const inConversation = /^\/(?:g\/[^/]+\/)?c\//.test(location.pathname);
  return {
    layout: found?.layout.name ?? null,
    answers: found?.replies.length ?? 0,
    recognized: Boolean(found) || !inConversation || isGenerating(),
  };
}

export function isGenerating() {
  return Boolean(
    queryFirst(SELECTORS.stopButton) ||
      queryFirst(SELECTORS.streamingMarker, { filter: isRendered }) ||
      lastTurnInProgress(),
  );
}

/** The newest turn declares a state other than finished (turn-key layout). */
function lastTurnInProgress() {
  const states = [...document.querySelectorAll(SELECTORS.turnState.selector)].filter(isRendered);
  const state = states.at(-1)?.getAttribute(SELECTORS.turnState.attribute);
  return Boolean(state) && !SELECTORS.turnState.finished.test(state);
}

// ---- Locating the answer ----------------------------------------------------

/** Every answer block of the exchange containing `reply`, in order. */
function answerBlocksOf(reply, { layout, replies }) {
  const turn = reply.closest(layout.turn);
  return turn ? replies.filter((r) => turn.contains(r)) : [reply];
}

function findById(messageId, found) {
  const reply = found?.replies.find((r) => r.getAttribute(found.layout.replyIdAttribute) === messageId);
  if (!reply) throw new RouterError(ErrorCode.NO_CONTENT, `Message ${messageId} not found`);
  return reply;
}

/** Last user prompt located before `reply` in the page. */
function promptFor(reply, layout) {
  const prompts = uniqueBlocks(renderedMatches(layout.prompt), '').filter((p) => precedes(p, reply));
  return prompts.at(-1)?.textContent.trim() ?? '';
}

function toMarkdown(reply, layout) {
  const content = queryFirst(layout.content, { root: reply, filter: () => true })?.element ?? reply;
  return htmlToMarkdown(content, {
    ignore: SELECTORS.ignoreInContent,
    codeBlocks: SELECTORS.codeBlocks,
    codeLanguageLabels: SELECTORS.codeLanguageLabels,
  });
}

/**
 * Every rendered exchange holding an answer, with the id of its (last)
 * answer block — where the "Send to Claude" buttons go.
 * @returns {{turn: Element, messageId: string | null}[]}
 */
export function listAnswerTurns() {
  const found = detectLayout();
  if (!found) return [];
  const byTurn = new Map();
  for (const reply of found.replies) {
    const turn = reply.closest(found.layout.turn) ?? reply;
    byTurn.set(turn, reply.getAttribute(found.layout.replyIdAttribute)); // last one wins
  }
  return [...byTurn].map(([turn, messageId]) => ({ turn, messageId }));
}

// ---- Public API ---------------------------------------------------------------

/**
 * @typedef {Object} ExtractedAnswer
 * @property {string} markdown
 * @property {string} prompt      The user message that led to this answer.
 * @property {string | null} messageId
 * @property {number} length
 * @property {string} layout      Which ChatGPT layout was recognised.
 */

/**
 * @param {{messageId?: string}} [options]
 * @returns {ExtractedAnswer}
 */
export function extract({ messageId } = {}) {
  const found = detectLayout();
  if (!found) throw new RouterError(ErrorCode.NO_CONTENT, 'No assistant answer recognised on the page');

  // While ChatGPT writes, the newest answer may not be recognisable yet: the
  // "latest" one found could be the previous answer. Never guess — refuse,
  // unless a specific older answer was explicitly requested.
  const reply = messageId ? findById(messageId, found) : found.replies.at(-1);
  const isLatest = reply.closest(found.layout.turn) === found.replies.at(-1).closest(found.layout.turn);
  if ((!messageId || isLatest) && isGenerating()) {
    throw new RouterError(ErrorCode.STILL_GENERATING, 'Answer still streaming');
  }

  const blocks = messageId ? [reply] : answerBlocksOf(reply, found);
  const markdown = blocks
    .map((block) => toMarkdown(block, found.layout))
    .filter(hasText)
    .join('\n\n');
  if (!hasText(markdown)) throw new RouterError(ErrorCode.NO_CONTENT, 'Answer is empty');

  return {
    markdown,
    prompt: promptFor(blocks[0], found.layout),
    messageId: blocks.at(-1).getAttribute(found.layout.replyIdAttribute),
    length: markdown.length,
    layout: found.layout.name,
  };
}
